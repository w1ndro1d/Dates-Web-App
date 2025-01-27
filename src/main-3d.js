import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { radians, userData } from 'three/tsl';

let selectedPlanet = null;

//define canvas, scene and camera
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// camera.layers.enable(0);
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
// console.log(canvas); // should log the canvas element to console

const orbits = [];

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(200);
camera.position.setY(25);

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
skybox.raycast = () => { };  //disable raycasting for skybox
// skybox.layers.set(1); //assign layer 1 to skybox, rest of the objects will be in layer 0(don't want raycaster to get blocked by skybox)


//define the shape, material and lights for central sphere(sun)
const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
const sunTexture = new THREE.TextureLoader().load('sun-texture.jpg');
const sunNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({ map: sunTexture, normalMap: sunNormalTexture, emissive: new THREE.Color(0xFC9601), emissiveIntensity: 0.05 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);

const pointLight = new THREE.PointLight(0xFFFFFF);
pointLight.position.set(10, 10, 10);
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
controls.maxDistance = 370;
controls.zoomSpeed = 0.4;

function addStars() {
  //define a star
  const starGeometry = new THREE.SphereGeometry(0.1, 24, 24);
  const starMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
  const star = new THREE.Mesh(starGeometry, starMaterial);

  //define random positions for stars
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(700));
  star.position.set(x, y, z);
  scene.add(star);
}
//add 1000 stars
Array(1000).fill().forEach(addStars);


//logic to show login/signup button if not logged in, show profile button if logged in
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const myEventsButton = document.getElementById("myevents");
  const profileButton = document.getElementById("profile");
  const dropdown = document.querySelector(".dropdown");
  const logoutButton = document.getElementById("logout");
  const toggleOrbitsCheckbox = document.getElementById("toggleorbits")

  const myEventsPopupWindow = document.getElementById("myeventspopup");
  const myEventsPopupCloseButton = document.getElementById("myevents-popup-done-btn");

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
        toggleOrbitsCheckbox.display = "flex";
        logoutButton.style.display = "flex";

        myEventsButton.addEventListener("click", async (e) => {
          myEventsPopupWindow.style.display = "flex";
          popup.style.display = "none";

          //populate popup
          let events = await fetchResponse(userEmail);
          populateEventsTable(events);
          dropdown.classList.remove("show");
          profileButton.classList.remove("profile-button-active");
          // console.log(events);
        })

        myEventsPopupCloseButton.addEventListener("click", () => {
          myEventsPopupWindow.style.display = "none";
        });

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

          const isDropDownVisible = dropdown.style.display === "inline-block";
          if (isDropDownVisible) {
            profileButton.classList.remove("profile-button-active");
          }
          else {
            profileButton.classList.add("profile-button-active");
          }

          dropdown.classList.toggle("show");
        });

        // Hide dropdown when clicking outside
        window.addEventListener("click", (e) => {
          if (!dropdown.contains(e.target) && !profileButton.contains(e.target)) {
            dropdown.classList.remove("show");
            profileButton.classList.remove("profile-button-active");
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

async function fetchResponse(userEmail) {
  try {
    const response = await fetch('https://localhost:7275/api/DateDetails/' + userEmail)
    const events = await response.json();
    // console.log(events);
    if (!Array.isArray(events) || events.length === 0) {
      console.error("No corresponding dates found in database!");
      return;
    }
    return events;
  }
  catch (error) {
    console.error("Error during fetch or no corresponding dates found in database!");
  }
}

function populateEventsTable(events) {
  const eventsTableBody = document.querySelector("#myevents-table tbody");
  eventsTableBody.innerHTML = "";

  //loop through events and add rows
  events.forEach(event => {
    const row = document.createElement("tr");

    //create cells for each field
    const eventDateCell = document.createElement("td");
    eventDateCell.textContent = new Date(event.eventDate).toISOString().split('T')[0];

    const eventTitleCell = document.createElement("td");
    eventTitleCell.textContent = event.event;

    const eventNoteCell = document.createElement("td");
    eventNoteCell.textContent = event.eventNote;

    const eventDaysLeft = document.createElement("td");
    eventDaysLeft.textContent = calculateDayDifference(event.eventDate);

    //create action buttons
    const actionCell = document.createElement("td");

    const editButton = document.createElement("button");
    //set properties
    editButton.id = "myevents-popup-edit-btn";
    editButton.textContent = "Edit";
    // editButton.addEventListener("click", () => editEvent(event));

    const deleteButton = document.createElement("button");
    //set properties
    deleteButton.id = "myevents-popup-delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => deleteEvent(event));

    actionCell.appendChild(editButton);
    actionCell.appendChild(deleteButton);

    // Append cells to the row
    row.appendChild(eventDateCell);
    row.appendChild(eventTitleCell);
    row.appendChild(eventNoteCell);
    row.appendChild(eventDaysLeft);
    row.appendChild(actionCell);

    // Append the row to the table body
    eventsTableBody.appendChild(row);
  })
}

async function deleteEvent(event) {
  // console.log(event.eventNote);
  if (!confirm(`Are you sure you want to delete the event: ${event.event}?`)) {
    return;
  };
  try {
    const response = await fetch(`https://localhost:7275/api/DateDetails/${event.dateId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
    // console.log(response);
    if (response.ok) {
      //delete from myevents popup and db
      // event.target.closest("tr").remove();
      // console.log(event.target.closest("tr"));
      alert("Event deleted!");
    }
    else {
      alert("Failed to delete event!");
    }
  }
  catch (error) {
    console.error("Error deleting event:", error);
    alert("An error occurred while deleting the event.");
  }

}

// function to populate planets around the sun based on API response(dates and events) with one-to-one mapping
async function PopulateDates(userEmail) {
  try {
    let events = await fetchResponse(userEmail);

    //TODO adjust planet's size based on importance of date to user
    //TODO allow users to add custom images as map texture to planets
    //generate sphere mesh as planet
    const planetGeometry = new THREE.SphereGeometry(3, 16, 16);
    const planetTexture = new THREE.TextureLoader().load('planet-texture.jpg');
    const planetNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');
    const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture, normalMap: planetNormalTexture, emissive: new THREE.Color(0xFC9601), emissiveIntensity: 0.1 });

    events.forEach((event, index) => {
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);

      //create a group to act as orbit center
      const orbitGroup = new THREE.Group();
      const orbitalRadius = calculateOrbitalRadius(event.eventDate);
      planet.position.set(orbitalRadius, 0, 0);

      //create orbit lines, use EllipseCurve instead of CircleGeometry to prevent visible lines spanning from center to circumference
      const curve = new THREE.EllipseCurve(
        0, 0,               // x and y center
        orbitalRadius, orbitalRadius, // xRadius, yRadius
        0, 2 * Math.PI,     // Start and end angles
        false               // Counterclockwise
      );
      const pointsForCurve = curve.getPoints(128);
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(pointsForCurve);
      // const orbitGeometry = new THREE.CircleGeometry(orbitalRadius, 64);
      const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xAAAAAA, transparent: true, opacity: 0.3 });
      const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
      orbitLine.rotation.x = Math.PI / 2; //align orbit line to x-z plane
      orbitGroup.add(orbitLine);

      //add planet to orbit group and orbit group to the scene
      orbitGroup.add(planet);

      //attach event details as metadata
      planet.userData = { isPlanet: true, radius: 3, event }; //set key for default radius to 3, will update later via slider
      // console.log(planet.userData);

      scene.add(orbitGroup);
      orbits.push({ orbitGroup, planet, orbitLine });
      // console.log(planet.position);

      // //set position in orbit
      // const x = orbitalRadius * Math.cos(angle);
      // const z = orbitalRadius * Math.sin(angle);
      // planet.position.set(x, 0, z);
    });

    //toggle orbits functionality
    const toggleCheckbox = document.getElementById('toggleorbits');
    toggleCheckbox.addEventListener('change', (event) => {
      const visible = event.target.checked;
      // console.log(visible);
      orbits.forEach(({ orbitLine }) => {
        orbitLine.visible = visible;
      })
    });
  }
  catch (error) {
    console.error("Error during fetch or no corresponding dates found in database!" + error);
  }
}

//dynamically resize canvas with window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



//calculate orbitalRadius and return it to populate planets around the sun
function calculateOrbitalRadius(eventDateFromAPI) {
  // Define the min and max orbital radii
  const minRadius = 80;  //closest to the sun
  const maxRadius = 200; //farthest from the sun

  let daysDiff = calculateDayDifference(eventDateFromAPI);

  //calculate distance factor based on daysdiff
  const distanceFactor = Math.max(0, 1 - Math.abs(daysDiff) / 365)  //farther dates should have higher distanceFactor
  // console.log(distanceFactor);
  // const orbitalRadius = 80 + index * 30;  //distance from sun
  const orbitalRadius = maxRadius - distanceFactor * (maxRadius - minRadius); //set distance from sun based on distanceFactor
  // console.log(orbitalRadius);
  return orbitalRadius;
}

function calculateDayDifference(tillThisDate) {
  const today = new Date();  //today's date

  //parse event date from API(under key eventDate)
  const eventDate = new Date(tillThisDate);

  // console.log(eventDate);
  //extract only the month and day for comparison
  const eventMonth = eventDate.getMonth(); // 0-11
  const eventDay = eventDate.getDate(); // 1-31
  const todayMonth = today.getMonth(); // 0-11
  const todayDay = today.getDate(); // 1-31

  //calculate days till the event without considering the year
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; //jan-dec
  const currentYear = today.getFullYear();

  //adjust for leap year if today is in February
  if (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0)) {
    daysInMonth[1] = 29; // february has 29 days
  }

  let daysDiff = 0;
  if (eventMonth > todayMonth || (eventMonth === todayMonth && eventDay >= todayDay)) {
    // Event is later in the same year
    for (let i = todayMonth; i < eventMonth; i++) {
      daysDiff += daysInMonth[i];
    }
    daysDiff += eventDay - todayDay;
  } else {
    // Event is earlier in the next year
    for (let i = todayMonth; i < 12; i++) {
      daysDiff += daysInMonth[i];
    }
    for (let i = 0; i < eventMonth; i++) {
      daysDiff += daysInMonth[i];
    }
    daysDiff += eventDay - todayDay;
  }
  // console.log(daysDiff);
  return daysDiff;
}


//onclick popup handler for planets
const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popup-title");
const popupDetails = document.getElementById("popup-details");
const popupClose = document.getElementById("popup-close");

const slider = document.getElementById('popup-slider');
const decrease = document.getElementById('slider-decrease');
const increase = document.getElementById('slider-increase');

//close popup function
popupClose.addEventListener("click", () => {
  popup.style.display = "none";
});

//event listener for clicks on planet spheres
//3js doesn't support native event listeners for meshes, so we need to use a raycaster to project a ray from mouse position into our 3d space and check if it intersects with our objects(planets in this case)
renderer.domElement.addEventListener("click", (event) => {
  const mouse = new THREE.Vector2();

  //calculate mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  //create a raycaster
  const raycaster = new THREE.Raycaster();

  //set the ray from the camera through the user's mouse position
  raycaster.setFromCamera(mouse, camera);
  // raycaster.layers.set(0);

  //find intersected objects
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    let clickedPlanet = intersects[0].object;
    // console.log(intersects);
    // intersects[0].object.material.color.set(0xff0000); // looks like skybox is being selected every time, must set skybox to a separate layer so raycaster doesn't detect it
    // console.log(clickedPlanet.userData.isPlanet);

    while (clickedPlanet && !clickedPlanet.userData?.isPlanet) {
      clickedPlanet = clickedPlanet.parent;
    }

    // Check if the clicked object is a planet
    if (clickedPlanet && clickedPlanet.userData.isPlanet) {
      selectedPlanet = clickedPlanet; //store the clicked planet globally for future reference
      let planetEventDetails = clickedPlanet.userData.event;
      // console.log(clickedPlanet.userData.event.event);
      // console.log(clickedPlanet.userData.event.eventNote);

      //TODO set popup title colour based on how close the event is(red for close, green for further out)
      //show the popup with event details
      // console.log(planetEventDetails.eventDate);
      let daysToGoForEvent = calculateDayDifference(planetEventDetails.eventDate);
      // console.log(daysToGoForEvent);
      popupTitle.textContent = planetEventDetails.event + " (" + daysToGoForEvent + " days left)" || "Unknown Event";
      popupDetails.textContent = planetEventDetails.eventNote || "No details available.";

      // Show the popup
      popup.style.display = "block";
      // console.log(clickedPlanet.userData.radius);
      slider.value = clickedPlanet.userData.radius;
    }
  }
})

//----------------------------event details popup slider controls---------------------------------------------
decrease.addEventListener('click', () => {
  slider.value = Math.max(slider.min, slider.value - 1);
  adjustPlanetSizes();
});

increase.addEventListener('click', () => {
  slider.value = Math.min(slider.max, Number(slider.value) + 1);
  adjustPlanetSizes();
});

//also change size with slider thumb
slider.addEventListener('input', adjustPlanetSizes);

//thought of just changing scale after slider is adjusted but that introduced inconsistencies in sphere sizes, depending on position of planet in its orbit
//so need to recreate sphere geometry with the new radius and replace the existing one after each resize, done inside fxn setPlanetRadiusForResize
function adjustPlanetSizes() {
  if (selectedPlanet) {
    const newSize = parseFloat(slider.value);
    setPlanetRadiusForResize(selectedPlanet, newSize);
    // console.log(newSize);
  }
}

function setPlanetRadiusForResize(planet, radius) {
  if (radius <= 0) return;
  const material = planet.material;

  // dispose of the old geometry to free up memory
  if (planet.geometry) planet.geometry.dispose();

  // create new geometry with the selected radius
  const newGeometry = new THREE.SphereGeometry(radius, 16, 16);
  planet.geometry = newGeometry;
  planet.material = material;

  //set userdata radius to new value, so slider values and planet radii are in sync
  planet.userData.radius = radius;
}
//-----------------------------------------slider controls-----------------------------------------------------

//animation loop
function animate() {
  requestAnimationFrame(animate);

  //spin the sun around, anti-clockwise
  // sun.rotation.x += 0.00001;  //slight tilt along x-axis
  sun.rotation.y -= 0.00015;
  // sun.rotation.z += 0.0001;
  skybox.rotation.y += 0.00002;

  //rotate each orbit group

  orbits.forEach(({ orbitGroup, planet }, index) => {
    const rotationSpeed = 0.0002 + index * 0.0002; //vary rotation speed of planet
    const revolutionSpeed = 0.0001 + ((9 - planet.userData.radius) * 0.0001); //vary revolution speed of planet, larger planet should revolve slower
    planet.rotation.y += rotationSpeed;
    orbitGroup.rotation.y += revolutionSpeed;
  });

  //for orbit controls
  controls.update();
  //render the entire scene with camera
  renderer.render(scene, camera);
}
animate()