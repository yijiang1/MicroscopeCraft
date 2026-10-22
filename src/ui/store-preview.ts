import type { StoreItem } from '../shared/economy';

/** Lightweight, offline product illustrations; no image downloads or extra render loop. */
export function storePreview(item: StoreItem): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 240 150');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${item.name} preview`);
  svg.style.cssText = 'display:block;width:100%;height:100%;';
  const title = document.createElementNS(ns, 'title'); title.textContent = item.name; svg.append(title);
  // Only fixed markup enters innerHTML; catalog titles are inserted as text below.
  const artwork = document.createElementNS(ns, 'g');
  const shadow = '<ellipse cx="120" cy="132" rx="56" ry="7" fill="#0a161d" opacity=".2"/>';
  if (item.id === 'binoculars') {
    artwork.innerHTML=shadow+'<path d="M91 45L68 114H110L116 45ZM149 45L124 114H166L174 45Z" fill="#375862" stroke="#102c36" stroke-width="3"/><rect x="105" y="69" width="35" height="18" rx="7" fill="#19363e"/><ellipse cx="89" cy="113" rx="24" ry="15" fill="#152c37"/><ellipse cx="145" cy="113" rx="24" ry="15" fill="#152c37"/><ellipse cx="89" cy="111" rx="17" ry="10" fill="#75b3cf"/><ellipse cx="145" cy="111" rx="17" ry="10" fill="#75b3cf"/><path d="M79 108L91 105M135 108L147 105" stroke="#d2f3f9" stroke-width="3"/><rect x="90" y="38" width="28" height="13" rx="4" fill="#152c37"/><rect x="148" y="38" width="28" height="13" rx="4" fill="#152c37"/>';
  } else if (item.kind === 'tool') {
    artwork.innerHTML = shadow + '<path d="M68 123L145 25" stroke="#c69c65" stroke-width="7" stroke-linecap="round"/><path d="M145 25Q178 52 173 104" fill="none" stroke="#e7f4ed" stroke-width="1.5"/><path d="M173 104V116Q173 127 164 119" fill="none" stroke="#b8d0df" stroke-width="2"/><circle cx="85" cy="104" r="10" fill="#628a9f" stroke="#dae8e7" stroke-width="3"/><path d="M65 126L83 104" stroke="#26333b" stroke-width="10"/>';
  } else if (item.kind === 'car') {
    artwork.innerHTML = shadow + '<path d="M32 101L44 83L91 77L105 53H145L159 78L195 86L207 110H30Z" fill="#d42132" stroke="#721724" stroke-width="2"/><path d="M101 76L111 57H140L151 76Z" fill="#b2e3f0"/><path d="M141 57L156 77H116" fill="#213440"/><rect x="45" y="77" width="22" height="13" rx="2" fill="#ed3442"/><rect x="47" y="80" width="18" height="8" fill="#fff3c9"/><circle cx="66" cy="111" r="18" fill="#14212a"/><circle cx="66" cy="111" r="10" fill="#b9c9d0"/><circle cx="173" cy="111" r="18" fill="#14212a"/><circle cx="173" cy="111" r="10" fill="#b9c9d0"/><path d="M91 87H153" stroke="#ff7a80" stroke-width="2"/>';
  } else if (item.kind === 'eyewear') {
    const dark = item.id === 'sunglasses';
    artwork.innerHTML = shadow + `<path d="M45 69L62 43H91M195 69L178 43H149" fill="none" stroke="${dark ? '#c5a461' : '#273c48'}" stroke-width="6" stroke-linecap="round"/><rect x="40" y="65" width="68" height="45" rx="12" fill="${dark ? '#182b33' : '#bce5ef'}" fill-opacity="${dark ? 1 : .35}" stroke="${dark ? '#c5a461' : '#273c48'}" stroke-width="6"/><rect x="132" y="65" width="68" height="45" rx="12" fill="${dark ? '#182b33' : '#bce5ef'}" fill-opacity="${dark ? 1 : .35}" stroke="${dark ? '#c5a461' : '#273c48'}" stroke-width="6"/><path d="M108 78Q120 69 132 78" fill="none" stroke="${dark ? '#c5a461' : '#273c48'}" stroke-width="6"/><path d="M52 79L69 73M144 79L161 73" stroke="#e4f6ff" stroke-opacity=".6" stroke-width="3"/>`;
  } else if (item.kind === 'shirt') {
    const color = item.id === 'shirt_red' ? '#b32235' : item.id === 'shirt_blue' ? (item.name === 'Black turtleneck' ? '#1f2126' : '#8ec9ee') : '#f0f2ed';
    artwork.innerHTML = shadow + `<path d="M91 40L67 52L53 79L75 91L85 73V121H155V73L165 91L187 79L173 52L149 40L136 37H104Z" fill="${color}" stroke="#17333c" stroke-width="2" stroke-linejoin="round"/><path d="M104 37Q120 59 136 37" fill="#233b46" stroke="#17333c" stroke-width="2"/><path d="M86 74L92 113H149L155 74" fill="none" stroke="#17333c" opacity=".15"/><path d="M120 53V120" stroke="#17333c" opacity="${item.id === 'shirt_lab' ? '.4' : '0'}"/><rect x="133" y="68" width="14" height="15" rx="2" fill="#17333c" opacity=".16"/>`;
  } else if (item.kind === 'backpack') {
    artwork.innerHTML = shadow + '<path d="M83 61Q64 79 78 120M157 61Q176 79 162 120" fill="none" stroke="#25323c" stroke-width="10"/><path d="M104 40V29Q120 15 136 29V40" fill="none" stroke="#283944" stroke-width="7"/><rect x="81" y="38" width="78" height="91" rx="20" fill="#a92338" stroke="#202e36" stroke-width="2"/><path d="M88 60Q120 46 152 60" stroke="#e98f96" stroke-width="2" fill="none"/><rect x="91" y="86" width="58" height="33" rx="8" fill="#7e192b"/><path d="M98 93H142" stroke="#e8b9a7" stroke-width="2"/><rect x="114" y="65" width="12" height="9" rx="2" fill="#e3d2a9"/>';
  } else if (item.kind === 'model') {
    artwork.innerHTML = shadow + '<path d="M108 109Q167 103 151 57" fill="none" stroke="#8ec9ee" stroke-width="15"/><path d="M108 109Q167 103 151 57" fill="none" stroke="#d6edf4" stroke-width="3"/><rect x="72" y="118" width="99" height="10" rx="5" fill="#37454e"/><path d="M119 115V99" stroke="#37454e" stroke-width="12"/><path d="M88 90H142" stroke="#37454e" stroke-width="7"/><path d="M129 41L111 69" stroke="#45565f" stroke-width="17"/><path d="M133 35L127 44" stroke="#172c38" stroke-width="20"/><path d="M111 68L103 81" stroke="#d8e3df" stroke-width="8"/><circle cx="148" cy="73" r="8" fill="#273a44"/><circle cx="148" cy="73" r="3" fill="#a8c7c9"/>';
  } else {
    const colors = ['#407a79', '#9b5264', '#526b9b', '#867044'];
    const hash = [...item.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const cover = colors[hash % colors.length];
    artwork.innerHTML = shadow + `<path d="M78 25L158 20L168 29V126L87 134L77 127Z" fill="#eee7cf"/><path d="M78 25L158 20V120L78 128Z" fill="${cover}"/><path d="M78 25L88 24V127L78 128Z" fill="#102c36" opacity=".5"/><path d="M89 127L162 121M89 130L162 124" stroke="#baaF96"/><path d="M99 50H145M99 54H136" stroke="#fff9e4" opacity=".45"/><circle cx="122" cy="83" r="19" fill="none" stroke="#e7dbab" stroke-width="1.4"/><ellipse cx="122" cy="83" rx="8" ry="19" fill="none" stroke="#e7dbab" transform="rotate(50 122 83)"/><circle cx="122" cy="83" r="3" fill="#e7dbab"/>`;
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', '98'); label.setAttribute('y', '40'); label.setAttribute('fill', '#fff8e7');
    label.setAttribute('font-size', '9'); label.setAttribute('font-family', 'system-ui'); label.setAttribute('font-weight', '700');
    label.textContent = item.id.startsWith('bio_') ? item.name.split(' — ')[0]!.split(' ').map(s => s[0]).join('').slice(0, 5) : item.id === 'book_optics' ? 'OPTICS' : 'SCATTERING';
    artwork.append(label);
  }
  svg.append(artwork);
  return svg;
}
