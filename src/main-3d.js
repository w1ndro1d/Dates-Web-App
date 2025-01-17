import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { radians } from 'three/tsl';

//define canvas, scene and camera
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
const orbits = [];
console.log(canvas); // should log the canvas element to console

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(220);

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
const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
const sunTexture = new THREE.TextureLoader().load('sun-texture.jpg');
const sunNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({map: sunTexture, normalMap: sunNormalTexture, emissive: new THREE.Color(0xFC9601), emissiveIntensity: 0.05});
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
controls.minDistance = 170;
controls.maxDistance = 500;
controls.zoomSpeed = 0.4;

function addStars(){
  //define a star
  const starGeometry = new THREE.SphereGeometry(0.1, 24, 24);
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
  // sun.rotation.x += 0.00001;  //slight tilt along x-axis
  sun.rotation.y -= 0.00015;
  // sun.rotation.z += 0.0001;
  skybox.rotation.y += 0.00002;
  
  //rotate each orbit group
  orbits.forEach(({orbitGroup, planet}, index) => {
    const rotationSpeed = 0.0002 + index * 0.002; //vary rotation speed of planet
    const revolutionSpeed = 0.001 + index * 0.0005; //vary revolution speed of planet
    planet.rotation.y += rotationSpeed;
    orbitGroup.rotation.y += revolutionSpeed;
  });

  //for orbit controls
  controls.update();
  //render the entire scene with camera
  renderer.render(scene, camera);
}
animate()

//logic to show login/signup button if not logged in, show profile button if logged in
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const myEventsButton = document.getElementById("myevents");
  const profileButton = document.getElementById("profile");
  const dropdown = document.querySelector(".dropdown");
  const logoutButton = document.getElementById("logout");

  if (token) {
    try {
      const decodedToken = decodeToken(token);
      const userEmail = decodedToken.unique_name;

      if (userEmail) {
        // Hide login/signup button
        loginSignupButton.style.display = "none";
        modal.style.display = "none";

        // Show My Events button
        // only show this as part of dropdown
        myEventsButton.style.display = "flex"; 
        logoutButton.style.display = "flex";    

        logoutButton.addEventListener("click", (e) => {
          localStorage.clear();
          location.reload();
        })

        // Show profile button with the user's email
        profileButton.style.display = "flex";
        profileButton.textContent = userEmail;

        // Toggle dropdown visibility on click
        profileButton.addEventListener("click", (e) => {
          e.preventDefault();
          dropdown.classList.toggle("show");
        });

        // Hide dropdown when clicking outside
        window.addEventListener("click", (e) => {
          if (!dropdown.contains(e.target) && !profileButton.contains(e.target)) {
            dropdown.classList.remove("show");
          }
        });

        // Populate planets(dates)
        await PopulateDates(userEmail);

        return; // Exit if the token is valid
      }
    } catch (error) {
      console.error("Error decoding token: ", error);
      // Clear invalid token from localStorage
      localStorage.removeItem("token");
    }
  }

  // If no valid token, ensure login/signup button is visible
  // const loginSignupButton = document.getElementById("login");
  loginSignupButton.style.display = "flex";

  // Ensure profile button is hidden
  // const profileButton = document.getElementById("profile");
  profileButton.style.display = "none";
});

// function to populate planets around the sun based on API response(dates and events) with one-to-one mapping
async function PopulateDates(userEmail){
  try{
    const response = await fetch('https://localhost:7275/api/DateDetails/' + userEmail)
    const events = await response.json();
    // console.log(events);
    if(!Array.isArray(events) || events.length === 0){
      console.error("No corresponding dates found in database!");
      return;
    }
    
    //generate sphere mesh as planet
    const planetGeometry = new THREE.SphereGeometry(5, 16, 16);
    const planetTexture = new THREE.TextureLoader().load('planet-texture.jpg');
    const planetNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');
    const planetMaterial = new THREE.MeshStandardMaterial({map: planetTexture, normalMap: planetNormalTexture, emissive: new THREE.Color(0xFC9601), emissiveIntensity: 0.1});

    events.forEach((event, index) => {
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);

      //create a group to act as orbit center
      const orbitGroup = new THREE.Group();

      //set planet's position in orbit
      const orbitalRadius = 150 + index * 50;  //distance from sun
      planet.position.set(orbitalRadius, 0, 0);

      //add planet to orbit group and orbit group to the scene
      orbitGroup.add(planet);
      scene.add(orbitGroup);
      orbits.push({orbitGroup, planet});

      // //set position in orbit
      // const x = orbitalRadius * Math.cos(angle);
      // const z = orbitalRadius * Math.sin(angle);
      // planet.position.set(x, 0, z);

      //attach event details as metadata
      planet.userData = {event};
    })
  }
  catch(error){
    console.error("Error during fetch or no corresponding dates found in database!");
  }
}

//dynamically resize canvas with window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});