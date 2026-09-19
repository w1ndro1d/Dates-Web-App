import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import spaceTextureUrl from '../space-texture.jpg';
import sunTextureUrl from '../sun-texture.jpg';
import sunNormalTextureUrl from '../sun-normal-map.jpg';

import { api } from './api.js';
import { modal, loginSignupButton, sessionReady, showNotification } from './login-signup-handler.js';
import './dialogs.js';
import { localDate, occurrenceDate, daysBetween } from '../shared/calendar.js';

let allEvents = [];
let showThisWeekOnly = false;
let focusMode = false;
function parseCalendarDate(value) { return new Date(value.substring(0, 10) + 'T12:00:00Z'); }
function todayFor(event) { return localDate(new Date(), event.timeZoneId || 'UTC'); }
function getNextEventDate(event) {
  return occurrenceDate(event.eventDate.substring(0, 10), event.isRecurring, todayFor(event));
}
function getDaysUntilEvent(event) { return daysBetween(todayFor(event), getNextEventDate(event)); }

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

function getPlanetBandForOrbit(orbitalRadius) {
  const solarSystemPalette = [
    0xb9bbb3, // Mercury
    0xf0b347, // Venus
    0x378fe8, // Earth
    0xe0523d, // Mars
    0xe18a4f, // Jupiter
    0xf0cc72, // Saturn
    0x56dce8, // Uranus
    0x3f70f2  // Neptune
  ];
  const normalizedDistance = THREE.MathUtils.clamp((orbitalRadius - 80) / 120, 0, 0.999);
  return {
    index: Math.floor(normalizedDistance * solarSystemPalette.length),
    color: new THREE.Color(solarSystemPalette[Math.floor(normalizedDistance * solarSystemPalette.length)])
  };
}

const planetTextureCache = new Map();

function getPlanetTexture(planetIndex) {
  if (planetTextureCache.has(planetIndex)) {
    return planetTextureCache.get(planetIndex);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const profiles = [
    { base: '#8b8d88', detail: '#4f514e', pattern: 'craters' },
    { base: '#d49b4d', detail: '#f0c878', pattern: 'clouds' },
    { base: '#1768b0', detail: '#4caf68', pattern: 'earth' },
    { base: '#a94235', detail: '#e27a47', pattern: 'craters' },
    { base: '#b56d42', detail: '#f0c08a', pattern: 'bands' },
    { base: '#d5b875', detail: '#f0dca9', pattern: 'bands' },
    { base: '#55bdc8', detail: '#a8e5e8', pattern: 'bands' },
    { base: '#2448a2', detail: '#5986e0', pattern: 'bands' }
  ][planetIndex];

  context.fillStyle = profiles.base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (profiles.pattern === 'bands') {
    for (let y = 0; y < canvas.height; y += 14) {
      context.fillStyle = y % 28 === 0 ? profiles.detail : profiles.base;
      context.globalAlpha = y % 28 === 0 ? 0.7 : 0.35;
      context.fillRect(0, y, canvas.width, 8 + (y % 9));
    }
  } else if (profiles.pattern === 'earth') {
    context.fillStyle = profiles.detail;
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 67) % canvas.width;
      const y = (index * 41) % canvas.height;
      context.beginPath();
      context.ellipse(x, y, 8 + (index % 5) * 4, 4 + (index % 4) * 3, index, 0, Math.PI * 2);
      context.fill();
    }
  } else if (profiles.pattern === 'craters') {
    for (let index = 0; index < 30; index += 1) {
      const x = (index * 83) % canvas.width;
      const y = (index * 47) % canvas.height;
      context.fillStyle = index % 2 ? profiles.detail : '#333936';
      context.globalAlpha = 0.35;
      context.beginPath();
      context.arc(x, y, 2 + (index % 5), 0, Math.PI * 2);
      context.fill();
    }
  } else {
    for (let index = 0; index < 32; index += 1) {
      context.fillStyle = index % 2 ? profiles.detail : '#f3d89c';
      context.globalAlpha = 0.12;
      context.beginPath();
      context.arc((index * 53) % canvas.width, (index * 29) % canvas.height, 7 + (index % 8), 0, Math.PI * 2);
      context.fill();
    }
  }

  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  planetTextureCache.set(planetIndex, texture);
  return texture;
}

function getOrbitPhase(event, index) {
  const seed = Math.abs((event.dateId || 0) * 9301 + index * 49297 + 233280);
  return (seed % 233280) / 233280 * Math.PI * 2;
}

//define canvas, scene and camera
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// camera.layers.enable(0);
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas }); }
catch {
  // Event management remains usable on devices without WebGL.
  renderer = { domElement: canvas, setPixelRatio() {}, setSize() {}, render() {} };
  showNotification('The 3D view is unavailable on this device. Your events are still available in the profile menu.', 'info', 'Simple view');
}
// console.log(canvas); // should log the canvas element to console

const orbits = [];

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
camera.position.setZ(255);
camera.position.setY(25);

//add space skybox
const spaceTexture = new THREE.TextureLoader().load(spaceTextureUrl);
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


function createSunGlowTexture() {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowGradient.addColorStop(0, 'rgba(255, 255, 226, 1)');
  glowGradient.addColorStop(0.16, 'rgba(255, 226, 126, 0.82)');
  glowGradient.addColorStop(0.38, 'rgba(255, 185, 52, 0.4)');
  glowGradient.addColorStop(0.68, 'rgba(255, 128, 12, 0.12)');
  glowGradient.addColorStop(1, 'rgba(255, 82, 0, 0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 256, 256);

  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

//define the shape, material and lights for central sphere(sun)
const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
const sunTexture = new THREE.TextureLoader().load(sunTextureUrl);
const sunNormalTexture = new THREE.TextureLoader().load(sunNormalTextureUrl);
const sunMaterial = new THREE.MeshStandardMaterial({
  map: sunTexture,
  normalMap: sunNormalTexture,
  emissive: new THREE.Color(0xffa326),
  emissiveIntensity: 0.38,
  roughness: 0.72,
  metalness: 0
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);

const sunGlowTexture = createSunGlowTexture();
const sunGlowMaterial = new THREE.SpriteMaterial({
  map: sunGlowTexture,
  color: 0xffb943,
  transparent: true,
  opacity: 0.3,
  blending: THREE.AdditiveBlending,
  depthTest: false,
  depthWrite: false
});
const sunGlow = new THREE.Sprite(sunGlowMaterial);
sunGlow.scale.set(185, 185, 1);
sunGlow.renderOrder = -2;

const sunCoronaMaterial = new THREE.SpriteMaterial({
  map: sunGlowTexture,
  color: 0xffd16b,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthTest: false,
  depthWrite: false
});
const sunCorona = new THREE.Sprite(sunCoronaMaterial);
sunCorona.scale.set(115, 115, 1);
sunCorona.renderOrder = -1;

const pointLight = new THREE.PointLight(0xffdf9a, 1.4);
pointLight.position.set(10, 10, 10);
const ambientLight = new THREE.AmbientLight(0xFFFFFF);

//add helpers
const lightHelper = new THREE.PointLightHelper(pointLight)
const gridHelper = new THREE.GridHelper(500, 100)
// scene.add(lightHelper, gridHelper)
scene.add(skybox, sunGlow, sunCorona, sun, pointLight, ambientLight);

const sunGlowClock = new THREE.Clock();
const solarFlares = [0.25, 1.7, 3.15, 4.65].map((angle, index) => {
  const flareMaterial = new THREE.SpriteMaterial({
    map: sunGlowTexture,
    color: 0xffd77a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
  });
  const flareSprite = new THREE.Sprite(flareMaterial);
  flareSprite.position.set(Math.cos(angle) * 47, Math.sin(angle) * 47, 0);
  flareSprite.scale.set(28 + index * 3, 12 + index * 2, 1);
  flareMaterial.rotation = angle + Math.PI / 2;
  flareSprite.renderOrder = 1;
  flareSprite.visible = false;
  scene.add(flareSprite);
  return { sprite: flareSprite, material: flareMaterial };
});
let activeSolarFlare = null;
let nextSolarFlareAt = 3;

// scene.add(sun, pointLight, ambientLight);

//add orbit controls to pan around with mouse, based on camera defined above
const controls = new OrbitControls(camera, renderer.domElement);
//only allow zooming in and out, no panning
controls.enablePan = false;
controls.enableZoom = true;
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.22;
controls.minPolarAngle = 0.72;
controls.maxPolarAngle = 2.42;
controls.minDistance = 170;
controls.maxDistance = 370;
controls.zoomSpeed = 0.18;

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


// The server authenticates an HttpOnly cookie; no session secret is exposed to JavaScript.
sessionReady.then(async user => {
  const profileButton = document.getElementById('profile');
  const dropdown = document.querySelector('.dropdown');
  const eventsPanel = document.getElementById('myeventspopup');
  loginSignupButton.style.display = user ? 'none' : 'flex';
  profileButton.style.display = user ? 'flex' : 'none';
  if (!user) return;
  document.getElementById('profile-email').textContent = user.email;
  const closeMenu = () => {
    dropdown.classList.remove('show');
    profileButton.classList.remove('profile-button-active');
    profileButton.setAttribute('aria-expanded', 'false');
  };
  profileButton.setAttribute('aria-expanded', 'false');
  profileButton.addEventListener('click', event => {
    event.preventDefault();
    const open = dropdown.classList.toggle('show');
    profileButton.classList.toggle('profile-button-active', open);
    profileButton.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('click', event => { if (!dropdown.contains(event.target)) closeMenu(); });
  dropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeMenu(); profileButton.focus(); }
  });
  const myEvents = document.getElementById('myevents');
  myEvents.style.display = 'flex';
  myEvents.addEventListener('click', async event => {
    event.preventDefault(); eventsPanel.style.display = 'flex'; popup.style.display = 'none'; closeMenu();
    await refreshEvents();
  });
  document.getElementById('myevents-popup-done-btn').addEventListener('click', () => { eventsPanel.style.display = 'none'; });
  document.getElementById('myevents-popup-new-btn').addEventListener('click', () => openEventForm());
  const week = document.getElementById('myevents-week-filter');
  week.addEventListener('click', () => {
    showThisWeekOnly = !showThisWeekOnly;
    week.textContent = showThisWeekOnly ? 'Show all' : 'This week';
    week.setAttribute('aria-pressed', String(showThisWeekOnly));
    renderEvents();
  });
  document.getElementById('focus-mode-toggle').addEventListener('change', event => {
    focusMode = event.target.checked;
    document.body.classList.toggle('focus-mode', focusMode);
    renderEvents();
  });
  const logout = document.getElementById('logout');
  logout.style.display = 'flex';
  let loggingOut = false;
  logout.addEventListener('click', async event => {
    event.preventDefault();
    if (loggingOut) return;
    loggingOut = true;
    try { await api('/Authentication/logout', { method: 'POST' }); location.reload(); }
    catch (error) { showNotification(error.message, 'error', 'Could not sign out'); loggingOut = false; }
  });
  await refreshEvents();
});
function tableState(message, retry = false) {
  const body = document.querySelector('#myevents-table tbody');
  body.replaceChildren();
  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'table-state';
  cell.append(document.createTextNode(message));
  if (retry) {
    const button = document.createElement('button');
    button.textContent = 'Try again';
    button.addEventListener('click', refreshEvents);
    cell.append(button);
  }
  const row = document.createElement('tr');
  row.append(cell); body.append(row);
}
async function fetchResponse() { return api('/DateDetails'); }

function populateEventsTable(events) {
  if (!events.length) {
    tableState(showThisWeekOnly || focusMode ? 'No events in the next seven days.' : 'No events yet. Add your first important date.');
    return;
  }
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
    editButton.className = "myevents-popup-edit-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openEventForm(event));

    const deleteButton = document.createElement("button");
    //set properties
    deleteButton.className = "myevents-popup-delete-btn";
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
  const date = typeof value === 'string' ? parseCalendarDate(value) : value;
  return date.toLocaleDateString(undefined, {
    timeZone: 'UTC',
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

const confirmationDialog = document.getElementById('confirmation-dialog');
const confirmationDialogTitle = document.getElementById('confirmation-dialog-title');
const confirmationDialogMessage = document.getElementById('confirmation-dialog-message');
const confirmationDialogConfirm = document.getElementById('confirmation-dialog-confirm');

function confirmAction({ title, message, confirmLabel = 'Confirm' }) {
  confirmationDialogTitle.textContent = title;
  confirmationDialogMessage.textContent = message;
  confirmationDialogConfirm.textContent = confirmLabel;
  confirmationDialog.returnValue = 'cancel';
  confirmationDialog.showModal();

  return new Promise((resolve) => {
    confirmationDialog.addEventListener('close', () => {
      resolve(confirmationDialog.returnValue === 'confirm');
    }, { once: true });
  });
}

confirmationDialog.addEventListener('click', (event) => {
  const rect = confirmationDialog.getBoundingClientRect();
  if (event.target === confirmationDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
    confirmationDialog.close('cancel');
  }
});

async function deleteEvent(event, row) {
  if (row.dataset.pending) return;
  row.dataset.pending = 'true';
  try {
    const confirmed = await confirmAction({
      title: 'Delete this event?',
      message: `“${event.event}” will be permanently removed.`,
      confirmLabel: 'Delete event'
    });
    if (!confirmed) return;
    row.querySelectorAll('button').forEach(button => { button.disabled = true; });
    await api(`/DateDetails/${event.dateId}`, { method: 'DELETE' });
    allEvents = allEvents.filter(existing => existing.dateId !== event.dateId);
    renderEvents();
    document.getElementById('myevents-popup-new-btn').focus();
  } catch (error) { showNotification(error.message, 'error', 'Could not delete event'); }
  finally {
    delete row.dataset.pending;
    row.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

function clearEventObjects() {
  while (orbits.length > 0) {
    const [{ orbitGroup, planet, orbitLine }] = orbits.splice(0, 1);
    scene.remove(orbitGroup);
    planet.geometry.dispose();
    planet.material.dispose();
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

    events.forEach((event, index) => {
      const importance = Math.min(10, Math.max(1, event.importance || 5));
      const planetRadius = 2 + importance * 0.5;
      const planetGeometry = new THREE.SphereGeometry(planetRadius, 16, 16);
      const orbitalRadius = calculateOrbitalRadius(event);
      const planetBand = getPlanetBandForOrbit(orbitalRadius);
      const planetMaterial = new THREE.MeshStandardMaterial({
        map: getPlanetTexture(planetBand.index),
        color: 0xffffff,
        roughness: planetBand.index > 3 ? 0.72 : 0.62,
        metalness: 0,
        emissive: planetBand.color,
        emissiveIntensity: 0.24
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);

      //create a group to act as orbit center
      const orbitGroup = new THREE.Group();
      const orbitPhase = getOrbitPhase(event, index);
      planet.position.set(
        orbitalRadius * Math.cos(orbitPhase),
        0,
        orbitalRadius * Math.sin(orbitPhase)
      );

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
  planet.material.dispose();
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
const reminderAllInput = document.getElementById('reminder-all');
const reminderMonthInput = document.getElementById('reminder-month');
const reminderWeekInput = document.getElementById('reminder-week');
const reminderDayInput = document.getElementById('reminder-day');
const reminderSameDayInput = document.getElementById('reminder-same-day');
let editingEventId = null;
let editingTimeZone = 'UTC';

function setAllReminderInputs(checked) {
  reminderMonthInput.checked = checked;
  reminderWeekInput.checked = checked;
  reminderDayInput.checked = checked;
  reminderSameDayInput.checked = checked;
}

function updateAllReminderInput() {
  reminderAllInput.checked = reminderMonthInput.checked && reminderWeekInput.checked &&
    reminderDayInput.checked && reminderSameDayInput.checked;
}

function openEventForm(event = null) {
  editingEventId = event?.dateId ?? null;
  editingTimeZone = event?.timeZoneId || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  eventFormTitle.textContent = editingEventId ? 'Edit Event' : 'Add Event';
  eventNameInput.value = event?.event ?? '';
  eventDateInput.value = event ? event.eventDate.substring(0, 10) : '';
  eventRecurringInput.checked = event?.isRecurring ?? false;
  eventImportanceInput.value = event?.importance ?? 5;
  eventImportanceValue.value = eventImportanceInput.value;
  eventImportanceValue.textContent = eventImportanceInput.value;
  reminderMonthInput.checked = event?.reminderOneMonth ?? false;
  reminderWeekInput.checked = event?.reminderOneWeek ?? false;
  reminderDayInput.checked = event?.reminderOneDay ?? false;
  reminderSameDayInput.checked = event?.reminderSameDay ?? false;
  updateAllReminderInput();
  eventNoteInput.value = event?.eventNote ?? '';
  eventFormModal.style.display = 'flex';
}

function closeEventForm() {
  if (savingEvent) return;
  eventFormModal.style.display = 'none';
  eventForm.reset();
  editingEventId = null;
}

let savingEvent = false;
async function saveEvent(formEvent) {
  formEvent.preventDefault();
  if (savingEvent) return;
  savingEvent = true;
  const submit = document.getElementById('event-form-submit');
  const cancel = document.getElementById('event-form-cancel');
  submit.disabled = cancel.disabled = true;
  submit.textContent = 'Saving…';
  const request = {
    event: eventNameInput.value.trim(), eventDate: eventDateInput.value, timeZoneId: editingTimeZone,
    isRecurring: eventRecurringInput.checked, importance: Number(eventImportanceInput.value),
    eventNote: eventNoteInput.value.trim(), reminderOneMonth: reminderMonthInput.checked,
    reminderOneWeek: reminderWeekInput.checked, reminderOneDay: reminderDayInput.checked,
    reminderSameDay: reminderSameDayInput.checked
  };
  const eventId = editingEventId;
  try {
    const saved = await api(eventId ? `/DateDetails/${eventId}` : '/DateDetails', {
      method: eventId ? 'PUT' : 'POST', body: request
    });
    allEvents = [...allEvents.filter(event => event.dateId !== saved.dateId), saved];
    savingEvent = false;
    closeEventForm();
    renderEvents();
    showNotification(eventId ? 'Your event was updated.' : 'Your event was added.', 'success', eventId ? 'Event updated' : 'Event added');
  } catch (error) { showNotification(error.message, 'error', 'Could not save event'); }
  finally {
    savingEvent = false; submit.disabled = cancel.disabled = false; submit.textContent = 'Save';
  }
}
function renderEvents() {
  updateClosestEvent();
  populateEventsTable(getVisibleEvents());
  clearEventObjects();
  PopulateDates(getVisibleEvents());
}
let refreshing = false;
async function refreshEvents() {
  if (refreshing) return;
  refreshing = true;
  const container = document.getElementById('myevents-table-container');
  container.setAttribute('aria-busy', 'true');
  tableState('Loading your events…');
  try { allEvents = await fetchResponse(); renderEvents(); }
  catch (error) {
    tableState(error.message, true);
    showNotification(error.message, 'error', 'Could not load events');
    if (error.status === 401) modal.style.display = 'flex';
  } finally { refreshing = false; container.setAttribute('aria-busy', 'false'); }
}

eventForm.addEventListener('submit', saveEvent);
document.getElementById('event-form-cancel').addEventListener('click', closeEventForm);
reminderAllInput.addEventListener('change', () => setAllReminderInputs(reminderAllInput.checked));
[reminderMonthInput, reminderWeekInput, reminderDayInput, reminderSameDayInput].forEach((input) => {
  input.addEventListener('change', updateAllReminderInput);
});
eventImportanceInput.addEventListener('input', () => {
  eventImportanceValue.value = eventImportanceInput.value;
  eventImportanceValue.textContent = eventImportanceInput.value;
});

const topOverlay = document.getElementById('overlay');
const uiIdleDelay = 10000;
let uiIdleTimer;

function scheduleUiFade() {
  clearTimeout(uiIdleTimer);
  document.body.classList.remove('ui-idle');
  uiIdleTimer = setTimeout(() => {
    if (topOverlay.matches(':hover') || topOverlay.contains(document.activeElement)) {
      scheduleUiFade();
      return;
    }
    document.body.classList.add('ui-idle');
  }, uiIdleDelay);
}

['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, scheduleUiFade, { passive: true });
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    scheduleUiFade();
  }
});

scheduleUiFade();

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
document.getElementById('popup-done').addEventListener('click', () => { popup.style.display = 'none'; });

// Close the event details when the backdrop is clicked.
popup.addEventListener("click", (event) => {
  if (event.target === popup) {
    popup.style.display = "none";
  }
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
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  if (reducedMotion.matches) { controls.update(); renderer.render(scene, camera); return; }

  //spin the sun around, anti-clockwise
  // sun.rotation.x += 0.00001;  //slight tilt along x-axis
  sun.rotation.y -= 0.00015;
  const elapsedTime = sunGlowClock.getElapsedTime();
  const glowPulse = 1 + Math.sin(elapsedTime * 1.4) * 0.012;
  sunGlow.scale.set(185 * glowPulse, 185 * glowPulse, 1);
  sunCorona.scale.set(115 * glowPulse, 115 * glowPulse, 1);
  sunGlowMaterial.opacity = 0.28 + (glowPulse - 1) * 0.6;

  if (activeSolarFlare) {
    const flareProgress = (elapsedTime - activeSolarFlare.startedAt) / activeSolarFlare.duration;
    if (flareProgress >= 1) {
      activeSolarFlare.sprite.visible = false;
      activeSolarFlare = null;
      nextSolarFlareAt = elapsedTime + 3 + Math.random() * 5;
    } else {
      activeSolarFlare.material.opacity = Math.sin(flareProgress * Math.PI) * 0.42;
    }
  } else if (elapsedTime >= nextSolarFlareAt) {
    const flare = solarFlares[Math.floor(Math.random() * solarFlares.length)];
    flare.sprite.visible = true;
    activeSolarFlare = {
      ...flare,
      startedAt: elapsedTime,
      duration: 0.8 + Math.random() * 0.6
    };
  }
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
