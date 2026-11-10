const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
fs.writeFileSync(path.join(root,'Thinkbook_Open.html'),html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>').replace('<script src="app.js"></script>',()=>'<script>'+js+'</script>'));
console.log('Built Thinkbook_Open.html. Use the server edition for GPT.');

