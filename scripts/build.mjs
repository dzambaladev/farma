import fs from "node:fs";
import path from "node:path";

const root=process.cwd(), out=path.join(root,"dist");
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
const dataDir=path.join(root,"data","products");
const files=fs.readdirSync(dataDir).filter(x=>x.endsWith(".json"));
const datasets=files.map(f=>JSON.parse(fs.readFileSync(path.join(dataDir,f),"utf8")));
const products=datasets.flatMap(d=>d.drug_products||[]);
const ingredients=new Map(),brands=new Map(),sources=new Map();
for(const d of datasets){
 for(const x of d.ingredients||[])ingredients.set(x.id,x);
 for(const x of d.brands||[])brands.set(x.id,x);
 for(const x of d.sources||[])sources.set(x.id,x);
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const ingredientSlug=new Map([...ingredients.values()].map(x=>[x.id,slug(x.preferred_name||x.name_uk||x.id)]));
const brandName=id=>brands.get(id)?.name||"";
const productName=p=>{const b=brandName(p.brand_id);const st=p.strength_expression_original||p.ingredients?.map(i=>i.strength?.strength_expression_original).filter(Boolean).join(" + ")||"";return [b,st,p.dosage_form_original].filter(Boolean).join(" — ")||p.id};
const productUrl=p=>"/drug/"+slug(p.id)+"/";
const ingredientUrl=id=>"/ingredient/"+(ingredientSlug.get(id)||slug(id))+"/";
function shell(title,description,body){return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="https://farma.example${esc(globalThis.__url||"/")}"><link rel="stylesheet" href="/site.css"></head><body><header class="top"><div class="wrap nav"><a class="logo" href="/">Farma</a><span class="tag">Довідник лікарських препаратів</span></div></header>${body}<footer class="footer"><div class="wrap">Farma — незалежний інформаційний каталог. Не є медичною рекомендацією. Перевіряйте актуальну інформацію в офіційних джерелах та консультуйтеся з лікарем або фармацевтом.</div></footer></body></html>`;}
function writePage(url,title,description,body){globalThis.__url=url;const html=shell(title,description,body);const dest=path.join(out,url.replace(/^\//,""),"index.html");fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);}
fs.copyFileSync(path.join(root,"src/site.css"),path.join(out,"site.css"));
fs.copyFileSync(path.join(root,"src/search.js"),path.join(out,"search.js"));
const searchIndex=[];
for(const p of products){
 const name=productName(p),url=productUrl(p);
 const ing=p.ingredients||[];
 const ingNames=ing.map(i=>{const x=ingredients.get(i.ingredient_id);return x?.preferred_name||x?.name_uk||i.ingredient_id});
 const subtitle=[...ingNames,p.dosage_form_original].filter(Boolean).join(" · ");
 const reg=(datasets.flatMap(d=>d.registrations||[])).find(r=>r.id===p.registration_id);
 const brand=brandName(p.brand_id);
 const pSources=(p.source_assertion_ids||[]).map(id=>datasets.flatMap(d=>d.source_assertions||[]).find(a=>a.id===id)?.source_id).filter(Boolean);
 const sources=[...new Set([...pSources,...(reg?.source_id?[reg.source_id]:[])])].map(id=>sourcesMap(id)).filter(Boolean);
 const strengths=ing.map(i=>{const s=i.strength||{};const n=s.active_moiety_value;return n!=null?n+" "+(s.active_moiety_unit||""):s.strength_expression_original||""}).filter(Boolean);
 const body=`<main class="wrap page"><div class="breadcrumbs"><a href="/">Головна</a> / Препарати / ${esc(name)}</div><h1>${esc(name)}</h1><p class="lead">${esc(subtitle)}</p><div class="facts"><div class="fact"><b>Торговельна назва</b>${esc(brand||"Не вказано")}</div><div class="fact"><b>Лікарська форма</b>${esc(p.dosage_form_original||"Не вказано")}</div><div class="fact"><b>Діюча речовина</b>${ing.map((i,n)=>'<a href="'+ingredientUrl(i.ingredient_id)+'">'+esc(ingNames[n])+'</a>').join(", ")||"Не вказано"}</div><div class="fact"><b>Реєстраційний номер</b>${esc(reg?.registration_number||reg?.id||p.registration_id||"Не вказано")}</div></div><section class="panel"><h2>Склад і дозування</h2><div class="rows">${ing.map((i,n)=>{const s=i.strength||{};const val=s.active_moiety_value!=null?s.active_moiety_value+" "+(s.active_moiety_unit||""):s.strength_expression_original||"Значення не підтверджено";return '<div class="rowline"><b>'+esc(ingNames[n])+'</b><div>'+esc(val)+' <span class="muted">'+esc(s.basis||"")+'</span></div>'+(s.salt_or_ester_name?'<div class="muted">Хімічна форма: '+esc(s.salt_or_ester_name)+(s.salt_or_ester_value!=null?' — '+esc(s.salt_or_ester_value)+' '+esc(s.salt_or_ester_unit):"")+'</div>':"")+(s.equivalence_statement?'<div class="muted">'+esc(s.equivalence_statement)+'</div>':"")+'</div>'}).join("")}</div></section><section class="panel"><h2>Упаковки</h2>${(p.packages||[]).length?'<div class="rows">'+p.packages.map(x=>'<div class="rowline">'+esc(x.package_description_original||x.description_original||"Опис відсутній")+(x.verification==="unconfirmed"?' <span class="pill">потребує перевірки</span>':"")+'</div>').join("")+'</div>':'<p class="muted">Підтверджені відомості про упаковку відсутні.</p>'}</section><section class="panel"><h2>Реєстраційні відомості</h2><p>Статус у джерелі: <b>${esc(reg?.status_as_reported||"не підтверджено")}</b></p><p>Дата початку реєстрації: ${esc(reg?.valid_from_as_reported||"не вказана")}</p><p class="muted">Дані спостерігалися: ${esc(reg?.observed_at||"дата не вказана")}. Статус відображає стан джерела на дату перевірки.</p>${reg?.status_note?'<p class="notice">'+esc(reg.status_note)+'</p>':""}</section><section class="panel"><h2>Джерела</h2>${sources.map(s=>'<div class="source"><a href="'+esc(s.url)+'" rel="noopener noreferrer">'+esc(s.title||s.publisher)+'</a> <span class="muted">('+esc(s.accessed_at||"дата не вказана")+')</span></div>').join("")||'<p class="muted">Источники пока не привязаны к опубликованным утверждениям.</p>'}</section><p class="notice">Інформаційний каталог не призначає лікування, не визначає індивідуальну дозу та не рекомендує заміну препаратів. Перевіряйте актуальну інструкцію.</p></main>`;
 writePage(url,name+" — Farma","Довідкова інформація про "+name+": склад, дозування, форма випуску, упаковки та реєстраційні відомості.",body);
 searchIndex.push({title:name,subtitle,url,search:[name,brand,...ingNames,strengths,p.dosage_form_original,p.id].join(" ")});
}
function sourcesMap(id){return sources.get(id)}
for(const [id,ing] of ingredients){
 const related=products.filter(p=>(p.ingredients||[]).some(x=>x.ingredient_id===id));
 const title=ing.preferred_name||ing.name_uk||id;
 const body=`<main class="wrap page"><div class="breadcrumbs"><a href="/">Головна</a> / Діючі речовини</div><h1>${esc(title)}</h1><p class="lead">Довідкова сторінка діючої речовини. Нижче наведені варіанти продуктів, у складі яких вона зазначена в каталозі.</p><section class="panel"><h2>Препарати в каталозі</h2><div class="grid">${related.map(p=>'<article class="item"><h3><a href="'+productUrl(p)+'">'+esc(productName(p))+'</a></h3><div class="muted">'+esc(p.dosage_form_original||"")+'</div></article>').join("")||'<p class="muted">Поки немає пов’язаних препаратів.</p>'}</div></section><p class="notice">Наявність спільної діючої речовини сама по собі не є рекомендацією щодо взаємозаміни.</p></main>`;
 writePage(ingredientUrl(id),title+" — діюча речовина | Farma","Довідкова інформація про діючу речовину "+title+" та зареєстровані варіанти препаратів у каталозі.",body);
 searchIndex.push({title,subtitle:"Діюча речовина",url:ingredientUrl(id),search:[title,ing.name_uk,id].join(" ")});
}
const home=`<main><section class="hero"><div class="wrap"><h1>Знайти лікарський препарат — без плутанини в назвах і дозуваннях</h1><p>Незалежний довідковий каталог лікарських препаратів України. Розрізняємо діючі речовини, торговельні назви, лікарські форми та упаковки. Показуємо джерела даних.</p><form class="search" id="search-form"><input id="q" type="search" placeholder="Назва препарату або діюча речовина" aria-label="Пошук препарату"><button type="submit">Знайти</button></form></div></section><section class="section"><div class="wrap"><h2>Каталог</h2><p id="result-count" class="result-count">Завантаження каталогу…</p><div id="results" class="grid"></div></div></section><section class="section"><div class="wrap"><h2>Про каталог</h2><div class="panel"><p>Кожна картка описує конкретний варіант препарату: склад, дозування, лікарську форму та, за наявності даних, упаковку й реєстраційні відомості.</p><p class="muted">Це інформаційний проєкт, а не аптека, не сервіс призначення лікування та не інструмент автоматичного підбору аналогів.</p></div></div></section></main><script src="/search.js" defer></script>`;
writePage("/","Farma — каталог лікарських препаратів","Незалежний інформаційний каталог лікарських препаратів України з пошуком за назвою та діючою речовиною.",home);
fs.writeFileSync(path.join(out,"search-index.json"),JSON.stringify(searchIndex,null,2));
fs.writeFileSync(path.join(out,"robots.txt"),"User-agent: *\nAllow: /\nSitemap: https://farma.example/sitemap.xml\n");
const urls=["/",...products.map(productUrl),...[...ingredients.keys()].map(ingredientUrl)];
fs.writeFileSync(path.join(out,"sitemap.xml"),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'  <url><loc>https://farma.example'+u+'</loc></url>').join("\n")+'\n</urlset>');
console.log("Built",products.length,"drug pages and",ingredients.size,"ingredient pages.");
