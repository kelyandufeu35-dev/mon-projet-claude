// Sous-monde provisoire : un fond uni et une caméra fixe (sert à vérifier la chaîne avant de construire un plan).
import * as THREE from 'three';
import { configureCamera } from '../../../engine/camera.js';

export function createStub({ pipe, width, height, color = 0x202020 }) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color })));
  const camera = new THREE.PerspectiveCamera();
  const place = (cam) => configureCamera(cam, { pos: [0, 0, 3], target: [0, 0, 0], focal: 35, fstop: 16, aspect: width / height, near: 0.1, far: 20 });
  return {
    evaluate: () => ({ scene, camera, lens: place(camera) }),
    placeCamera: (cam) => place(cam),
    shutterFrac: () => 0.5,
    sampleFactor: () => 0.4,
  };
}
