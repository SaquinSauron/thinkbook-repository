const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
fs.writeFileSync(path.join(root,'Thinkbook_Open.html'),html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>').replace('<script src="app.js"></script>',()=>'<script>'+js+'</script>'));
console.log('Built Thinkbook_Open.html. Use the server edition for GPT.');
const lcHtml=fs.readFileSync(path.join(root,'leetcode.html'),'utf8');
const lcCss=fs.readFileSync(path.join(root,'leetcode.css'),'utf8');
const lcCore=fs.readFileSync(path.join(root,'leetcode-core.js'),'utf8');
const lcApp=fs.readFileSync(path.join(root,'leetcode.js'),'utf8');
fs.writeFileSync(path.join(root,'LeetCode_Companion.html'),lcHtml.replace('<link rel="stylesheet" href="leetcode.css">',()=>'<style>'+lcCss+'</style>').replace('<script src="leetcode-core.js"></script>',()=>'<script>'+lcCore+'</script>').replace('<script src="leetcode.js"></script>',()=>'<script>'+lcApp+'</script>'));
console.log('Built LeetCode_Companion.html. The full Two Sum lesson works without AI.');

