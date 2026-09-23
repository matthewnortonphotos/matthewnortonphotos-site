// Run from the repository root: node tests/verify-site.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const manifest = fs.readFileSync('scripts/image-manifest.js', 'utf8');
const definitions = html.slice(html.indexOf('    const galleryImages'), html.indexOf('    // ===== MOBILE HEADER'));
const grouping = html.slice(html.indexOf('    function groupGalleryPhotos'), html.indexOf('    const modal ='));
const context = vm.createContext({});
vm.runInContext(manifest + definitions + grouping + ';globalThis.data={galleryImages,strangerDetails,optimizedImages,groupGalleryPhotos};', context);
const {galleryImages, strangerDetails, optimizedImages, groupGalleryPhotos} = context.data;
const plain = value => JSON.parse(JSON.stringify(value));
const landscape = source => optimizedImages[source].width > optimizedImages[source].height;
let checks = 0;
function check(label, action) { action(); checks++; console.log('PASS ' + label); }

check('All gallery originals have optimized, existing variants', () => {
  for (const source of Object.values(galleryImages).flat()) {
    const image = optimizedImages[source];
    assert.ok(image && image.variants.length > 0, source);
    assert.ok(image.variants.every(v => fs.existsSync(v.src)), source);
  }
});
check('Grouping preserves every photo and relative portrait/landscape order', () => {
  for (const [key, sources] of Object.entries(galleryImages)) {
    const pages = plain(groupGalleryPhotos(sources));
    const flat = pages.flat();
    assert.deepEqual([...flat].sort(), [...sources].sort(), key);
    assert.deepEqual(flat.filter(s => !landscape(s)), plain(sources.filter(s => !landscape(s))), key);
    assert.deepEqual(flat.filter(landscape), plain(sources.filter(landscape)), key);
    assert.ok(pages.every(page => page.length <= 2 && (page.length === 1 || page.every(landscape))), key);
    assert.equal(pages.filter(page => page.length === 1 && landscape(page[0])).length, sources.filter(landscape).length % 2, key);
  }
});
check('Only partner landscapes move in an interleaved sequence', () => {
  const input=['p1','l1','p2','l2','p3','l3'];
  input.forEach(source => {optimizedImages[source]={width:source[0]==='l'?3:2,height:source[0]==='l'?2:3};});
  assert.deepEqual(plain(groupGalleryPhotos(input)), [['p1'],['l1','l2'],['p2'],['p3'],['l3']]);
});
check('Stranger Portraits retain the supplied subject order and video mapping', () => {
  const expected=[['Al Perkins','Da8Z5cmxQ5V'],['Sergeant Alex Shirley','DdSKHM8Rj_R'],['Alena','Db05rxtR5fg'],['Randy and Toni','Dc114KlRvy4'],['Jacquelyn','DdUFl2oxqap'],['Veronica and Teddy','DcSCElfNCTS']];
  assert.deepEqual(plain(galleryImages.strangers.map(source=>[strangerDetails[source].name,strangerDetails[source].video.split('/')[4]])),expected);
});
check('All script blocks parse and the form submits over HTTPS', () => {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  for (const path of ['scripts/inquiry-form.js','scripts/favicon.js','scripts/website-inquiries.gs']) new vm.Script(fs.readFileSync(path,'utf8'));
  assert.ok(!/<form[^>]*mailto:/.test(html));
  assert.match(html, /<form id="inquiryForm" action="https:\/\/script.google.com\//);
});
check('Local HTML asset references exist, with no obsolete favicon', () => {
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|mailto:)/.test(match[1])) continue;
    assert.ok(fs.existsSync(match[1]), match[1]);
  }
  assert.ok(!html.includes('MNmono5.PNG'));
});
console.log(`${checks} integrity checks passed.`);
