import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, createWriteStream, mkdirSync } from 'fs'
import { dirname } from 'path';
import * as http from "http"

const parser = new XMLParser();
let wp_export = parser.parse(readFileSync('wordpress-export.xml'));
let posts = wp_export.rss.channel.item;

let readme = `
# my-wordpress-blog
This is a backup of my Wordpress blog. (http://lf.estontorise.hu/)

`
const template = readFileSync('template.html')
for (const post of posts) {

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

    if (post['wp:post_type'] != 'post')
        continue;

    if (!post['pubDate'])
        continue;

    let content: string = template.toString()
    for (const key of Object.keys(post)) {
        content = content.split(`{{${key}}}`).join(post[key])
    }
    writeFileSync(`archives/${post['wp:post_id']}`, content)
    readme += `[${post.title}](https://thebojda.github.io/my-wordpress-blog/archives/${post['wp:post_id']})\n\n`
}

writeFileSync('README.md', readme)