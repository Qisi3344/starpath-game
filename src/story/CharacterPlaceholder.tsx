/**
 * 临时立绘资产 · 纯黑白/灰剪影。
 *
 * 统一 characterId 入口，后续正式立绘替换此组件的资源映射即可。
 * 无具体五官、肤色、发色：概念版人物不等于最终角色人设。
 */
type SilhouetteKind = 'manager' | 'rookie' | 'male' | 'longhair' | 'neutral';
const known: Record<string, {kind: SilhouetteKind; label: string}> = {
  zhixia: {kind: 'manager', label: '林知夏'},
  lu: {kind: 'rookie', label: '陆星遥'},
  yichen: {kind: 'male', label: '沈亦辰'},
  formerLover: {kind: 'male', label: '旧识'},
  candidateFemale: {kind: 'longhair', label: '新人候选'},
  candidateMale: {kind: 'male', label: '新人候选'},
};
/** 每人绑定稳定 id，未知人物也有可见的占位剪影。 */
export function CharacterPlaceholder({characterId}: {characterId: string}) {
  const p = known[characterId] ?? {kind: 'neutral' as const, label: '人物占位'};
  const bob = p.kind === 'manager';
  const longhair = p.kind === 'rookie' || p.kind === 'longhair';
  const short = p.kind === 'male';
  const rookie = p.kind === 'rookie';
  const manager = bob;
  const headShift = short ? -2 : 0;
  return <svg viewBox="0 0 330 540" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label={p.label + ' · 临时黑白剪影，未完成正式美术'}>
    <defs>
      <linearGradient id={'shadow-'+p.kind} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#17171b"/><stop offset="1" stopColor="#3d3b42"/>
      </linearGradient>
    </defs>
    <ellipse cx="165" cy="531" rx="120" ry="8" fill="#19181e" opacity=".2"/>
    {/* 统一上半身占位：成人体型、双肩、明确躯干 */}
    <path d={short ?
      'M52 540Q60 384 95 324Q131 292 165 298Q211 292 245 323Q277 383 289 540Z' :
      'M48 540Q56 397 91 333Q122 293 159 293Q211 288 245 328Q278 399 292 540Z'}
      fill={'url(#shadow-'+p.kind+')'} stroke="#f6f4f2" strokeWidth="2.5"/>
    {/* 服装剪影形状用于区分人物；不给具体衣服配色定稿 */}
    {manager || short
      ? <g fill="#e7e7e7"><path d="M118 306L160 393 139 540H91L113 363Z"/><path d="M211 303L168 393 195 540H248L219 361Z"/></g>
      : <path d="M118 310L165 381 215 310 231 540H100Z" fill="#e5e5e5" opacity=".84"/>}
    <path d="M143 267L145 316 165 342 188 316 190 267Z" fill="#c7c7c9"/>
    {longhair && <path d="M103 160Q95 62 169 64Q235 55 246 155L261 362Q242 393 218 376L212 236H118L113 378Q88 381 77 359Z"
      fill="#18171b" stroke="#ececec" strokeWidth="2"/>}
    {bob && <path d="M106 182Q83 104 114 78Q151 48 196 67Q251 85 235 192L240 297Q219 321 197 293H129Q99 321 93 287Z"
      fill="#19191e" stroke="#ededed" strokeWidth="2"/>}
    {short && <path d="M115 161Q105 102 126 87L149 70 176 76 195 62 214 92 233 123 220 181Z"
      fill="#19191e" stroke="#efefef" strokeWidth="2"/>}
    {!bob && !longhair && !short && <path d="M107 173Q90 96 141 70Q214 57 227 140L226 266 197 279 125 275Z"
      fill="#16161a" stroke="#eee" strokeWidth="2"/>}
    {/* 不画脸：留出素描式浅灰面部剪影 */}
    <path d={short ? 'M122 150Q130 113 171 113Q212 111 217 151L207 222Q194 268 166 278Q140 264 125 224Z'
      : 'M124 146Q132 111 172 110Q210 111 216 153L207 226Q195 268 166 276Q138 265 126 226Z'}
      transform={'translate(0 '+headShift+')'} fill="#d2d1d2" stroke="#f6f4f4" strokeWidth="2.5"/>
    <path d="M123 158Q118 121 141 98Q167 74 197 101L217 153Q199 135 191 122Q169 148 123 158Z"
      fill="#1a191e"/>
    {rookie && <><path d="M225 145L246 129 244 153 263 162 241 170 224 159Z" fill="#eee" opacity=".93"/>
      <path d="M107 245Q94 320 89 373M218 246Q234 313 244 374" fill="none" stroke="#f0f0f0" strokeWidth="2" opacity=".9"/></>}
    {bob && <><path d="M121 181l41 2m12-1 40-3" stroke="#fcfcfc" strokeWidth="3" fill="none"/><path d="M160 182l15 0" stroke="#ececec" strokeWidth="2"/></>}
    {short && <path d="M159 348L165 377 171 348 168 527 162 527Z" fill="#222127"/>}
    {manager && <path d="M230 412L278 426 266 503 216 490Z" fill="#77777b" stroke="#ececec" strokeWidth="3"/>}
    {/* 占位识别角标：与最终美术独立 */}
    <g opacity=".88"><rect x="89" y="490" width="152" height="31" rx="15.5" fill="#ededed"/>
      <text x="165" y="511" fontFamily="sans-serif" fontSize="12" textAnchor="middle" fill="#313034" letterSpacing="2">ART PLACEHOLDER</text>
    </g>
  </svg>;
}
