import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

//define canvas, scene and camera
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
console.log(canvas); // should log the canvas element to console

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(30);

//add space skybox
const spaceTexture = new THREE.TextureLoader().load('space-texture.jpg');
// const spaceTexture = new THREE.CubeTextureLoader().load([
//   'space-texture.jpg', 'space-texture.jpg', 'space-texture.jpg', 
//   'space-texture.jpg', 'space-texture.jpg', 'space-texture.jpg'
// ], 
//   (texture) => {
//   console.log('Skybox textures loaded.');
// }, undefined, (error) => {
//   console.error('Error loading skybox textures.', error);
// }
// );
// scene.background = spaceTexture;

const skyboxGeometry = new THREE.SphereGeometry(500, 64, 64);
const skyboxMaterial = new THREE.MeshBasicMaterial({
  map: spaceTexture, // Apply the skybox texture to the cube
  side: THREE.BackSide  // Render the inside of the cube
});
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);

//define the shape, material and lights for central sphere(sun)
const sunGeometry = new THREE.SphereGeometry(7, 32, 32);
const sunTexture = new THREE.TextureLoader().load('sun-texture.jpg');
const sunNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({map: sunTexture, normalMap: sunNormalTexture, emissive: new THREE.Color(0xFC9601), emissiveIntensity: 0.05,});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);

const pointLight = new THREE.PointLight(0xFFFFFF);
pointLight.position.set(10,10,10);
const ambientLight = new THREE.AmbientLight(0xFFFFFF);

//add helpers
const lightHelper = new THREE.PointLightHelper(pointLight)
const gridHelper = new THREE.GridHelper(500, 100)
// scene.add(lightHelper, gridHelper)
scene.add(skybox, sun, pointLight, ambientLight);

// scene.add(sun, pointLight, ambientLight);

//add orbit controls to pan around with mouse, based on camera defined above
const controls = new OrbitControls(camera, renderer.domElement);
//only allow zooming in and out, no panning
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 15;
controls.maxDistance = 500;
controls.zoomSpeed = 0.4;

function addStars(){
  //define a star
  const starGeometry = new THREE.SphereGeometry(0.35, 24, 24);
  const starMaterial = new THREE.MeshStandardMaterial({color: 0xFFFFFF});
  const star = new THREE.Mesh(starGeometry, starMaterial);

  //define random positions for stars
  const[x,y,z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(700));
  star.position.set(x,y,z);
  scene.add(star);
}

//add 1000 stars
Array(1000).fill().forEach(addStars);

//animation loop
function animate(){
  requestAnimationFrame(animate);

  //spin the sun around, anti-clockwise
  sun.rotation.x += 0.00001;  //slight tilt along x-axis
  sun.rotation.y -= 0.00015;
  // sun.rotation.z += 0.0001;
  skybox.rotation.y += 0.00002;

  //for orbit controls
  controls.update();
  //render the entire scene with camera
  renderer.render(scene, camera);
}

animate()