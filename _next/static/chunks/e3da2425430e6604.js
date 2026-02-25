(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,35174,a=>{"use strict";var e=a.i(43476);let s=(0,a.i(75254).default)("sword",[["path",{d:"m11 19-6-6",key:"s7kpr"}],["path",{d:"m5 21-2-2",key:"1kw20b"}],["path",{d:"m8 16-4 4",key:"1oqv8h"}],["path",{d:"M9.5 17.5 21 6V3h-3L6.5 14.5",key:"pkxemp"}]]);function t({label:a="Loading...",compact:t=!1,light:c=!1}){return(0,e.jsxs)("div",{className:`loading ${t?"loading--compact":""} ${c?"loading--light":""}`.trim(),role:"status","aria-live":"polite",children:[(0,e.jsx)(s,{className:"loading__icon"}),a?(0,e.jsx)("span",{className:"loading__label",children:a}):null]})}a.s(["default",()=>t],35174)},97936,a=>{"use strict";var e=a.i(43476);function s({children:a,onClick:s,type:t="button",variant:c="primary",disabled:i=!1}){return(0,e.jsx)("button",{className:`button button--${c}`,onClick:s,type:t,disabled:i,children:a})}a.s(["default",()=>s])},43531,1892,a=>{"use strict";let e=(0,a.i(75254).default)("check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);a.s(["Check",()=>e],43531);var s=a.i(17927);let t=`
  id,
  name,
  description,
  image_url,
  age,
  created_at,
  updated_at,
  state:states(id, name),
  classes:character_classes(class:classes(id, name)),
  races:character_races(race:races(id, name)),
  occupations:character_occupations(occupation:occupations(id, name)),
  associations:character_associations(association:associations(id, name)),
  places:character_places(place:places(id, name))
`,c=a=>({id:a.id,name:a.name,description:a.description,image_url:a.image_url,age:a.age,created_at:a.created_at,updated_at:a.updated_at,state:Array.isArray(a.state)?a.state[0]:a.state,classes:a.classes?.map(a=>a.class)??[],races:a.races?.map(a=>a.race)??[],occupations:a.occupations?.map(a=>a.occupation)??[],associations:a.associations?.map(a=>a.association)??[],places:a.places?.map(a=>a.place)??[]}),i=async(a={})=>{let{data:e,error:i}=await s.supabase.from("characters").select(t).order("name",{ascending:a.ascending??!0});if(i)throw i;return e.map(c)};a.s(["fetchCharacters",0,i],1892)},88699,a=>{"use strict";let e=(0,a.i(75254).default)("pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);a.s(["Pencil",()=>e],88699)}]);