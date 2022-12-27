import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, createWriteStream, mkdirSync } from 'fs'
import { dirname } from 'path';
import * as http from 'http'
import * as ejs from 'ejs';

function truncate(str: string, n: number) {
    return (str.length > n) ? str.slice(0, n - 1) : str;
}

async function main() {
    const parser = new XMLParser();
    let wp_export = parser.parse(readFileSync('wordpress-export.xml'));
    let posts = wp_export.rss.channel.item;

    const pinned_post_ids = [727, 645]
    let pinned_posts: any[] = []
    let post_list: any[] = []
    for (const post of posts) {

        // download attachments
        if (post['wp:post_type'] == 'attachment') {
            const url = post['wp:attachment_url'];
            for (const post_meta of post['wp:postmeta']) {
                if (post_meta['wp:meta_key'] == '_wp_attached_file') {
                    const file_path = post_meta['wp:meta_value']
                    const full_path = `wp-content/uploads/${file_path}`
                    mkdirSync(dirname(full_path), { recursive: true });
                    const file = createWriteStream(full_path);
                    http.get(url, (resp) => {
                        resp.pipe(file);
                        file.on("finish", () => {
                            file.close();
                        });
                    })
                }
            }
        }

        // generate post pages
        if (post['wp:post_type'] != 'post')
            continue;

        // only published posts    
        if (!post['pubDate'])
            continue;

        post['content:encoded'] = post['content:encoded'].split(/\r?\n|\r|\n/g).reduce((accumulator: string, currentValue: string) => accumulator + `<p>${currentValue}</p>`)

        const content = await ejs.renderFile("template.ejs", { post: post }, { async: true })
        mkdirSync(`archives/${post['wp:post_id']}`, { recursive: true });
        writeFileSync(`archives/${post['wp:post_id']}/index.html`, content)

        const element = {
            id: post['wp:post_id'],
            title: post.title,
            summary: truncate(post['content:encoded'].replace(/<[^>]*>?/gm, ''), 300)
        }

        if (pinned_post_ids.includes(post['wp:post_id'])) {
            pinned_posts.push(element)
        } else {
            post_list.push(element)
        }

    }

    // generate toc
    pinned_posts.sort((a, b) => { return b.id - a.id })
    let merged_posts = pinned_posts.concat(post_list.sort((a, b) => { return b.id - a.id }))

    // readme.md
    let readme = `
# my-wordpress-blog
This is a backup of my Wordpress blog. (http://lf.estontorise.hu/)


`
    for (const post of merged_posts)
        readme += `[${post.title}](https://thebojda.github.io/my-wordpress-blog/archives/${post.id})\n\n`
    writeFileSync('README.md', readme)

    // index.html
    const content = await ejs.renderFile("template_toc.ejs", { posts: merged_posts }, { async: true })
    writeFileSync(`index.html`, content)
}

main()