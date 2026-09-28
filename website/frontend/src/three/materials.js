import * as THREE from 'three';
import { sholaBump } from './textures.js';

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const M = {
  painted: (map, rough = 0.38) =>
    memo(`painted:${map.uuid}:${rough}`, () =>
      new THREE.MeshPhysicalMaterial({ map, roughness: rough, clearcoat: 0.75, clearcoatRoughness: 0.22 })),
  lacquer: (color, rough = 0.32) =>
    memo(`lacquer:${color}:${rough}`, () =>
      new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.9, clearcoatRoughness: 0.15 })),
  gold: () => memo('gold', () => new THREE.MeshStandardMaterial({ color: 0xe0a846, metalness: 1, roughness: 0.28 })),
  paleGold: () => memo('paleGold', () => new THREE.MeshStandardMaterial({ color: 0xf1cf7e, metalness: 1, roughness: 0.22 })),
  mirror: () =>
    memo('mirror', () => new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.85, roughness: 0.12, emissive: 0x3a3d44, envMapIntensity: 1.6 })),
  shola: () =>
    memo('shola', () => {
      const bump = sholaBump();
      bump.wrapT = THREE.RepeatWrapping;
      bump.repeat.set(3, 3);
      return new THREE.MeshStandardMaterial({ color: 0xf8f2e4, roughness: 0.82, bumpMap: bump, bumpScale: 1.4, side: THREE.DoubleSide });
    }),
  gem: (color) =>
    memo(`gem:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 })),
  foil: (map) =>
    memo(`foil:${map.uuid}`, () => new THREE.MeshPhysicalMaterial({ map, metalness: 0.65, roughness: 0.3, clearcoat: 0.6 })),
  silk: (color) =>
    memo(`silk:${color}`, () =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffe6c4), envMapIntensity: 0.6, side: THREE.DoubleSide })),
  rice: () => memo('rice', () => new THREE.MeshStandardMaterial({ color: 0xf6eedb, roughness: 0.7 })),
  pedestal: () =>
    memo('pedestal', () => new THREE.MeshPhysicalMaterial({ color: 0x2b0a0f, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })),
  fabric: (map) =>
    memo(`fabric:${map.uuid}`, () =>
      new THREE.MeshPhysicalMaterial({ map, roughness: 0.78, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) })),
  mat: (map) =>
    memo(`mat:${map.uuid}`, () => new THREE.MeshStandardMaterial({ map, roughness: 0.8, side: THREE.DoubleSide })),
};
