// Phosphor icons (MIT), imported individually as SVG so only used glyphs ship.
import heart from '@phosphor-icons/core/assets/light/heart-light.svg?raw';
import heartFill from '@phosphor-icons/core/assets/fill/heart-fill.svg?raw';
import bag from '@phosphor-icons/core/assets/light/shopping-bag-open-light.svg?raw';
import whatsappFill from '@phosphor-icons/core/assets/fill/whatsapp-logo-fill.svg?raw';
import whatsapp from '@phosphor-icons/core/assets/light/whatsapp-logo-light.svg?raw';
import list from '@phosphor-icons/core/assets/light/list-light.svg?raw';
import grab from '@phosphor-icons/core/assets/light/hand-grabbing-light.svg?raw';
import cube from '@phosphor-icons/core/assets/light/cube-light.svg?raw';
import squares from '@phosphor-icons/core/assets/light/squares-four-light.svg?raw';
import caretLeft from '@phosphor-icons/core/assets/light/caret-left-light.svg?raw';
import caretRight from '@phosphor-icons/core/assets/light/caret-right-light.svg?raw';
import leftRight from '@phosphor-icons/core/assets/light/arrows-left-right-light.svg?raw';
import arrowLeft from '@phosphor-icons/core/assets/light/arrow-left-light.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/light/arrow-right-light.svg?raw';
import arrowUpRight from '@phosphor-icons/core/assets/light/arrow-up-right-light.svg?raw';
import sparkle from '@phosphor-icons/core/assets/light/sparkle-light.svg?raw';
import undo from '@phosphor-icons/core/assets/light/arrow-counter-clockwise-light.svg?raw';
import eraser from '@phosphor-icons/core/assets/light/eraser-light.svg?raw';
import download from '@phosphor-icons/core/assets/light/download-simple-light.svg?raw';
import instagram from '@phosphor-icons/core/assets/light/instagram-logo-light.svg?raw';
import youtube from '@phosphor-icons/core/assets/light/youtube-logo-light.svg?raw';
import facebook from '@phosphor-icons/core/assets/light/facebook-logo-light.svg?raw';
import mapPin from '@phosphor-icons/core/assets/light/map-pin-light.svg?raw';
import x from '@phosphor-icons/core/assets/light/x-light.svg?raw';
import minus from '@phosphor-icons/core/assets/light/minus-light.svg?raw';
import plus from '@phosphor-icons/core/assets/light/plus-light.svg?raw';
import chat from '@phosphor-icons/core/assets/light/chat-circle-text-light.svg?raw';
import send from '@phosphor-icons/core/assets/light/paper-plane-tilt-light.svg?raw';
import userCircle from '@phosphor-icons/core/assets/light/user-circle-light.svg?raw';
import envelope from '@phosphor-icons/core/assets/light/envelope-simple-light.svg?raw';
import playFill from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import pauseFill from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import lotus from '@phosphor-icons/core/assets/light/flower-lotus-light.svg?raw';
import check from '@phosphor-icons/core/assets/light/check-circle-light.svg?raw';
import trash from '@phosphor-icons/core/assets/light/trash-light.svg?raw';
import share from '@phosphor-icons/core/assets/light/share-network-light.svg?raw';
import receipt from '@phosphor-icons/core/assets/light/receipt-light.svg?raw';
import shuffle from '@phosphor-icons/core/assets/light/shuffle-light.svg?raw';
import star from '@phosphor-icons/core/assets/light/star-light.svg?raw';
import starFill from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import sealCheck from '@phosphor-icons/core/assets/light/seal-check-light.svg?raw';
import pencil from '@phosphor-icons/core/assets/light/pencil-simple-line-light.svg?raw';
import clock from '@phosphor-icons/core/assets/light/clock-light.svg?raw';
import brush from '@phosphor-icons/core/assets/light/paint-brush-light.svg?raw';
import palette from '@phosphor-icons/core/assets/light/palette-light.svg?raw';
import textAa from '@phosphor-icons/core/assets/light/text-aa-light.svg?raw';
import linkSimple from '@phosphor-icons/core/assets/light/link-simple-light.svg?raw';
import zoomIn from '@phosphor-icons/core/assets/light/magnifying-glass-plus-light.svg?raw';
import searchIcon from '@phosphor-icons/core/assets/light/magnifying-glass-light.svg?raw';
import sliders from '@phosphor-icons/core/assets/light/sliders-horizontal-light.svg?raw';

const ICONS = {
  'light:heart': heart,
  'light:magnifying-glass': searchIcon,
  'light:sliders-horizontal': sliders,
  'light:user-circle': userCircle,
  'fill:heart': heartFill,
  'light:shopping-bag-open': bag,
  'fill:whatsapp-logo': whatsappFill,
  'light:whatsapp-logo': whatsapp,
  'light:list': list,
  'light:hand-grabbing': grab,
  'light:cube': cube,
  'light:magnifying-glass-plus': zoomIn,
  'light:squares-four': squares,
  'light:caret-left': caretLeft,
  'light:caret-right': caretRight,
  'light:arrows-left-right': leftRight,
  'light:arrow-left': arrowLeft,
  'light:arrow-right': arrowRight,
  'light:arrow-up-right': arrowUpRight,
  'light:sparkle': sparkle,
  'light:arrow-counter-clockwise': undo,
  'light:eraser': eraser,
  'light:download-simple': download,
  'light:instagram-logo': instagram,
  'light:youtube-logo': youtube,
  'light:facebook-logo': facebook,
  'light:map-pin': mapPin,
  'light:x': x,
  'light:minus': minus,
  'light:plus': plus,
  'light:chat-circle-text': chat,
  'light:paper-plane-tilt': send,
  'light:envelope-simple': envelope,
  'fill:play': playFill,
  'fill:pause': pauseFill,
  'light:flower-lotus': lotus,
  'light:check-circle': check,
  'light:trash': trash,
  'light:share-network': share,
  'light:receipt': receipt,
  'light:shuffle': shuffle,
  'light:star': star,
  'fill:star': starFill,
  'light:seal-check': sealCheck,
  'light:pencil-simple-line': pencil,
  'light:clock': clock,
  'light:paint-brush': brush,
  'light:palette': palette,
  'light:text-aa': textAa,
  'light:link-simple': linkSimple,
};

let tpl = null; // made on first use, so modules importing icons also load where there is no page (tests)

export function svgIcon(name, weight = 'light') {
  const raw = ICONS[`${weight}:${name}`] || ICONS[`light:${name}`];
  if (!raw) return document.createElement('span');
  tpl ||= document.createElement('template');
  tpl.innerHTML = raw.trim();
  const svg = tpl.content.firstElementChild;
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

/** Replaces <i class="ph-light ph-name"> placeholders in static markup with inline SVG. */
export function hydrateIcons(root = document) {
  for (const i of root.querySelectorAll('i[class*="ph-"]')) {
    const classes = [...i.classList];
    const weight = classes.includes('ph-fill') ? 'fill' : 'light';
    const name = classes.find((c) => c.startsWith('ph-') && c !== 'ph-fill' && c !== 'ph-light')?.slice(3);
    if (name) i.replaceWith(svgIcon(name, weight));
  }
}
