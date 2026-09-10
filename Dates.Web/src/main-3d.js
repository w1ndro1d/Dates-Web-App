import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { radians, userData } from 'three/tsl';

const API_BASE_URL = 'https://localhost:7275/api/DateDetails';
let allEvents = [];
let showThisWeekOnly = false;
let focusMode = false;

function authenticatedHeaders(includeJson = false) {
  const headers = {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  };
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function getNextEventDate(event) {
  const sourceDate = new Date(event.eventDate);
  if (!event.isRecurring) {
    return sourceDate;
  }

  const today = new Date();
  let nextDate = new Date(today.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
  nextDate.setHours(0, 0, 0, 0);
  if (nextDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    nextDate = new Date(today.getFullYear() + 1, sourceDate.getMonth(), sourceDate.getDate());
  }
  return nextDate;
}

function getDaysUntilEvent(event) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = getNextEventDate(event);
  eventDate.setHours(0, 0, 0, 0);
  return Math.ceil((eventDate - today) / millisecondsPerDay);
}

function isHappeningThisWeek(event) {
  const daysUntil = getDaysUntilEvent(event);
  return daysUntil >= 0 && daysUntil <= 7;
}

function getVisibleEvents() {
  if (showThisWeekOnly || focusMode) {
    return allEvents.filter(isHappeningThisWeek);
  }
  return allEvents;
}

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
  const focusModeButton = document.getElementById("focus-mode");
  const toggleOrbitsCheckbox = document.getElementById("toggleorbits")

  const myEventsPopupWindow = document.getElementById("myeventspopup");
  const myEventsPopupCloseButton = document.getElementById("myevents-popup-done-btn");
  const myEventsPopupNewButton = document.getElementById("myevents-popup-new-btn");
  const weekFilterButton = document.getElementById("myevents-week-filter");

  if (token) {
    try {
      const decodedToken = decodeToken(token);
      const userEmail = decodedToken.unique_name || decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];

      if (userEmail) {
        // Hide login/signup button
        loginSignupButton.style.display = "none";
        modal.style.display = "none";

        // Show My Events button
        // only show this as part of dropdown
        myEventsButton.style.display = "flex";
        toggleOrbitsCheckbox.style.display = "flex";
        focusModeButton.style.display = "flex";
        logoutButton.style.display = "flex";

        myEventsButton.addEventListener("click", async (e) => {
          myEventsPopupWindow.style.display = "flex";
          popup.style.display = "none";

          //populate popup
          allEvents = await fetchResponse();
          updateClosestEvent();
          populateEventsTable(getVisibleEvents());
          dropdown.classList.remove("show");
          profileButton.classList.remove("profile-button-active");
          // console.log(events);
        })

        myEventsPopupCloseButton.addEventListener("click", () => {
          myEventsPopupWindow.style.display = "none";
        });

        myEventsPopupNewButton.addEventListener("click", () => openEventForm());

        weekFilterButton.addEventListener("click", async () => {
          showThisWeekOnly = !showThisWeekOnly;
          weekFilterButton.textContent = showThisWeekOnly ? "Show all" : "This week";
          await refreshEvents();
        });

        focusModeButton.addEventListener("click", async (event) => {
          event.preventDefault();
          focusMode = !focusMode;
          document.body.classList.toggle("focus-mode", focusMode);
          focusModeButton.textContent = focusMode ? "Exit focus mode" : "Focus mode";
          await refreshEvents();
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
        await PopulateDates();

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

async function fetchResponse() {
  try {
    const response = await fetch(API_BASE_URL, {
      headers: authenticatedHeaders()
    });
    if (!response.ok) {
      throw new Error(`Unable to load events (${response.status})`);
    }
    return await response.json();
  }
  catch (error) {
    console.error("Error loading events:", error);
    return [];
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
    eventDateCell.textContent = formatEventDate(getNextEventDate(event));

    const addedDateCell = document.createElement("td");
    addedDateCell.textContent = formatAddedDate(event.initialLoggedDate);

    const eventTitleCell = document.createElement("td");
    eventTitleCell.textContent = `${event.event}${event.isRecurring ? " (yearly)" : ""}`;
    eventTitleCell.title = `Importance: ${event.importance}/10`;

    const eventNoteCell = document.createElement("td");
    eventNoteCell.textContent = event.eventNote;

    const eventDaysLeft = document.createElement("td");
    eventDaysLeft.textContent = getDaysUntilEvent(event);

    //create action buttons
    const actionCell = document.createElement("td");

    const editButton = document.createElement("button");
    //set properties
    editButton.id = "myevents-popup-edit-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openEventForm(event));

    const deleteButton = document.createElement("button");
    //set properties
    deleteButton.id = "myevents-popup-delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => deleteEvent(event, row));

    actionCell.appendChild(editButton);
    actionCell.appendChild(deleteButton);

    // Append cells to the row
    row.appendChild(eventDateCell);
    row.appendChild(addedDateCell);
    row.appendChild(eventTitleCell);
    row.appendChild(eventNoteCell);
    row.appendChild(eventDaysLeft);
    row.appendChild(actionCell);

    // Append the row to the table body
    eventsTableBody.appendChild(row);
  })
}

function formatEventDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatAddedDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function updateClosestEvent() {
  const summary = document.getElementById("event-summary");
  if (!summary) {
    return;
  }

  const closestEvent = allEvents
    .filter(event => getDaysUntilEvent(event) >= 0)
    .sort((first, second) => getDaysUntilEvent(first) - getDaysUntilEvent(second))[0];

  if (!closestEvent) {
    summary.textContent = "No upcoming events";
    return;
  }

  const daysUntil = getDaysUntilEvent(closestEvent);
  const countdown = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
  summary.textContent = `Closest: ${closestEvent.event} ${countdown}`;
}

async function deleteEvent(event, row) {
  // console.log(event.eventNote);
  if (!confirm(`Are you sure you want to delete the event: ${event.event}?`)) {
    return;
  };
  try {
    const response = await fetch(`${API_BASE_URL}/${event.dateId}`, {
      method: "DELETE",
      headers: authenticatedHeaders(),
    });
    // console.log(response);
    if (response.ok) {
      allEvents = allEvents.filter(existingEvent => existingEvent.dateId !== event.dateId);
      row.remove();
      removeEventFromScene(event.dateId);
      updateClosestEvent();
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

function clearEventObjects() {
  while (orbits.length > 0) {
    const [{ orbitGroup, planet, orbitLine }] = orbits.splice(0, 1);
    scene.remove(orbitGroup);
    planet.geometry.dispose();
    orbitLine.geometry.dispose();
    orbitLine.material.dispose();
  }
}

// function to populate planets around the sun based on API response(dates and events) with one-to-one mapping
async function PopulateDates(events = null) {
  try {
    if (!events) {
      allEvents = await fetchResponse();
      updateClosestEvent();
      events = getVisibleEvents();
    }

    //TODO allow users to add custom images as map texture to planets
    const planetTexture = new THREE.TextureLoader().load('planet-texture.jpg');
    const planetNormalTexture = new THREE.TextureLoader().load('sun-normal-map.jpg');

    events.forEach((event, index) => {
      const importance = Math.min(10, Math.max(1, event.importance || 5));
      const planetRadius = 2 + importance * 0.5;
      const planetGeometry = new THREE.SphereGeometry(planetRadius, 16, 16);
      const planetColor = new THREE.Color().setHSL((event.dateId * 0.137) % 1, 0.72, 0.56);
      const planetMaterial = new THREE.MeshStandardMaterial({
        map: planetTexture,
        normalMap: planetNormalTexture,
        color: planetColor,
        emissive: planetColor,
        emissiveIntensity: 0.12
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);

      //create a group to act as orbit center
      const orbitGroup = new THREE.Group();
      const orbitalRadius = calculateOrbitalRadius(event);
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
      planet.userData = { isPlanet: true, radius: planetRadius, event };
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
    toggleCheckbox.onchange = (event) => {
      const visible = event.target.checked;
      // console.log(visible);
      orbits.forEach(({ orbitLine }) => {
        orbitLine.visible = visible;
      })
    };
    toggleCheckbox.onchange({ target: toggleCheckbox });
  }
  catch (error) {
    console.error("Error during fetch or no corresponding dates found in database!" + error);
  }
}

function removeEventFromScene(dateId) {
  const orbitIndex = orbits.findIndex(({ planet }) => planet.userData.event.dateId === dateId);
  if (orbitIndex === -1) {
    return;
  }

  const [{ orbitGroup, planet, orbitLine }] = orbits.splice(orbitIndex, 1);
  scene.remove(orbitGroup);
  planet.geometry.dispose();
  orbitLine.geometry.dispose();
  orbitLine.material.dispose();
}

const eventFormModal = document.getElementById('eventFormModal');
const eventForm = document.getElementById('eventForm');
const eventFormTitle = document.getElementById('event-form-title');
const eventNameInput = document.getElementById('event-name');
const eventDateInput = document.getElementById('event-date');
const eventRecurringInput = document.getElementById('event-recurring');
const eventImportanceInput = document.getElementById('event-importance');
const eventImportanceValue = document.getElementById('event-importance-value');
const eventNoteInput = document.getElementById('event-note');
let editingEventId = null;

function openEventForm(event = null) {
  editingEventId = event?.dateId ?? null;
  eventFormTitle.textContent = editingEventId ? 'Edit Event' : 'Add Event';
  eventNameInput.value = event?.event ?? '';
  eventDateInput.value = event ? event.eventDate.substring(0, 10) : '';
  eventRecurringInput.checked = event?.isRecurring ?? false;
  eventImportanceInput.value = event?.importance ?? 5;
  eventImportanceValue.value = eventImportanceInput.value;
  eventImportanceValue.textContent = eventImportanceInput.value;
  eventNoteInput.value = event?.eventNote ?? '';
  eventFormModal.style.display = 'flex';
  eventNameInput.focus();
}

function closeEventForm() {
  eventFormModal.style.display = 'none';
  eventForm.reset();
  editingEventId = null;
}

async function saveEvent(formEvent) {
  formEvent.preventDefault();
  const request = {
    event: eventNameInput.value.trim(),
    eventDate: eventDateInput.value,
    isRecurring: eventRecurringInput.checked,
    importance: Number(eventImportanceInput.value),
    eventNote: eventNoteInput.value.trim()
  };
  const eventId = editingEventId;
  const url = eventId ? `${API_BASE_URL}/${eventId}` : API_BASE_URL;
  const method = eventId ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: authenticatedHeaders(true),
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Save event failed:', response.status, errorDetails);
      throw new Error(`Unable to save event (${response.status})`);
    }

    closeEventForm();
    await refreshEvents();
    alert(eventId ? 'Event updated!' : 'Event added!');
  } catch (error) {
    console.error('Error saving event:', error);
    alert(`${error.message}. Please try again.`);
  }
}

async function refreshEvents() {
  allEvents = await fetchResponse();
  updateClosestEvent();
  populateEventsTable(getVisibleEvents());
  clearEventObjects();
  await PopulateDates(getVisibleEvents());
}

eventForm.addEventListener('submit', saveEvent);
document.getElementById('event-form-close').addEventListener('click', closeEventForm);
document.getElementById('event-form-cancel').addEventListener('click', closeEventForm);
eventImportanceInput.addEventListener('input', () => {
  eventImportanceValue.value = eventImportanceInput.value;
  eventImportanceValue.textContent = eventImportanceInput.value;
});

//dynamically resize canvas with window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



//calculate orbitalRadius and return it to populate planets around the sun
function calculateOrbitalRadius(event) {
  // Define the min and max orbital radii
  const minRadius = 80;  //closest to the sun
  const maxRadius = 200; //farthest from the sun

  const daysDiff = getDaysUntilEvent(event);

  // Events within a week stay close to the sun; distant events move outward.
  const distanceFactor = Math.max(0, 1 - Math.max(0, daysDiff) / 365);
  const orbitalRadius = maxRadius - distanceFactor * (maxRadius - minRadius); //set distance from sun based on distanceFactor
  return orbitalRadius;
}


//onclick popup handler for planets
const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popup-title");
const popupDetails = document.getElementById("popup-details");
const popupClose = document.getElementById("popup-close");

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
      let planetEventDetails = clickedPlanet.userData.event;
      // console.log(clickedPlanet.userData.event.event);
      // console.log(clickedPlanet.userData.event.eventNote);

      //TODO set popup title colour based on how close the event is(red for close, green for further out)
      //show the popup with event details
      // console.log(planetEventDetails.eventDate);
      const daysToGoForEvent = getDaysUntilEvent(planetEventDetails);
      // console.log(daysToGoForEvent);
      popupTitle.textContent = planetEventDetails.event + " (" + daysToGoForEvent + " days left)" || "Unknown Event";
      popupDetails.textContent = planetEventDetails.eventNote || "No details available.";

      // Show the popup
      popup.style.display = "block";
    }
  }
})

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