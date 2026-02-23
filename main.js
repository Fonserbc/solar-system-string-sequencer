import * as THREE from 'three/webgpu';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import planet from './planet';
import { AU, c } from './constants';
import { lerp } from 'three/src/math/MathUtils';
import * as dat from 'dat.gui';
import * as Tone from 'tone';
import stellarString from './stellarString';
import starfield from './starfield';
import Stats from 'stats.js';
import timelineDisplay from './timelineDisplay';

// SSSS - Solar System String Sequencer

//#region config
let config = {
    daysPerSecond: 12, // 28
    soundVelocity: 1, // as a percentage of the speed of light, 1 = c
    unifiedScaleFactor: 0.15,
    realisticScaleFactor: 0.94,
    unifiedScale: 8,
    realisticScale: 26,
    camera: {
        fov: 75, 
        distance: 7,
        startingAngle: 30,
        rotatingSpeed: Math.PI,
        scrollSpeed: 0.005,
    },
    sun: {
        intensity:3,
    },
    bg: {
        backgroundColor: "#0a0a0a",
    },
    ux: {
        cameraHeight: 4,
        marginPercentage: 0.15,
        usabilityFactor: 0,
        doMousePluck: false,
        planetsVsSpaceFactor: 0.7,
        sunSizeMultiplier: 2.5,
        cameraAnimationTotalTime: 0.7,
    },
    synth: {
        attack: 0.12,
        decay: 0.4,
        sustain: 0.4,
        release: 1.6,
        volume: 1,
    },
    pluck: {
        attackNoise: 0.2,
        dampening: 1111,
        resonance: 0.975,
        release: 6.4
    },
    debug: {
        mouseStatus: false,
    },
    strings: {
        width: 0.04,
        stringWidth: 0.04,
        fragmentWidth: 0.2,
        fadeOutTime: 2,
        fadeOutTimeFrequency: 220,
        coloredEdge: 0.12,
        coloredEdgeStart: 0.12,
        stringColor: "#898989",
    },
    rings: {
        saturnRingSize: 2.4,
        saturnRingStart: 0.53,
        uranusRingSize: 2.3,
        uranusRingStart: 0.58,
    },
    orbitsVisible: true,
    wantedOutlineScreenPercentage: 0.02,
    midiNotesTime: Math.PI * 2,
}
//#endregion

//#region Setup & camera
let audioReady = false;
const canvas = document.getElementById("canvas");
canvas.addEventListener("pointerdown", async () => {
    if (!audioReady) {
        await Tone.start();
        audioReady = true;
        toneListener = new Tone.getListener();
    }
});
const safearea = document.getElementById("safe-area");

const VECTOR3 = {
    UP: new THREE.Vector3(0,1,0),
    DOWN: new THREE.Vector3(0,-1,0),
    LEFT: new THREE.Vector3(1,0,0),
    RIGHT: new THREE.Vector3(-1,0,0),
    FORWARD: new THREE.Vector3(0,0,1),
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( config.camera.fov, window.innerWidth / window.innerHeight, 0.001, 1024 );
const cameraRotatingPivot = new THREE.Object3D();
const cameraDistancePivot = new THREE.Object3D();
let camUxfQuat = new THREE.Quaternion().identity();
let cameraAngles = new THREE.Vector2(15 * THREE.MathUtils.DEG2RAD, 0);
cameraRotatingPivot.add(cameraDistancePivot);
cameraDistancePivot.position.z = config.camera.distance;
cameraRotatingPivot.setRotationFromAxisAngle(VECTOR3.RIGHT, cameraAngles.x);
cameraDistancePivot.quaternion.copy(cameraRotatingPivot.quaternion);
camUxfQuat.setFromAxisAngle(VECTOR3.RIGHT, Math.PI*0.5);
scene.add(cameraRotatingPivot);


let camMovementQuat = new THREE.Quaternion();
let camMovementVec = new THREE.Vector3();
let camUxfPos = new THREE.Vector3(0,config.ux.cameraHeight,0);
let hasMovedCamera = false;
let wasBuildingString = false;
const maxXCameraAngle = Math.PI*0.45;
let movedCameraAcc = 0;
function moveCamera(ev) {
    let x = deltaPointerPosition.x*config.camera.rotatingSpeed/windowHeight;
    let y = deltaPointerPosition.y*config.camera.rotatingSpeed/windowHeight;

    if (config.ux.usabilityFactor < 0.5) {
        cameraAngles.x = THREE.MathUtils.clamp(cameraAngles.x + y, -maxXCameraAngle, maxXCameraAngle);
        cameraAngles.y -= x;
    }
    else {
        if (pointerNormalizedPosition.x > 0) // right side
            cameraAngles.y += y;
        else cameraAngles.y -= y;

        if (pointerNormalizedPosition.y > 0) cameraAngles.y += x; // top
        else cameraAngles.y -= x;
    }
    
    cameraRotatingPivot.quaternion.setFromAxisAngle(VECTOR3.UP, cameraAngles.y);
    camUxfQuat.copy(cameraRotatingPivot.quaternion);
    camMovementQuat.setFromAxisAngle(VECTOR3.RIGHT, cameraAngles.x);
    cameraRotatingPivot.quaternion.multiply(camMovementQuat);
    cameraDistancePivot.quaternion.copy(cameraRotatingPivot.quaternion);

    let up = cameraAngles.x > 0;
    if (up || true) {
        camMovementQuat.setFromAxisAngle(VECTOR3.RIGHT, Math.PI * 0.5);
        camUxfQuat.multiply(camMovementQuat);
        camUxfPos.y = config.ux.cameraHeight;
    }
    else { // For some reason the quaternion slerp is misbehaving when under the solar system plane
        camMovementQuat.setFromAxisAngle(VECTOR3.RIGHT, -Math.PI * 0.5);
        camUxfQuat.multiply(camMovementQuat);
        camUxfPos.y = -config.ux.cameraHeight;
    }

    movedCameraAcc += (Math.abs(deltaPointerPosition.x) + Math.abs(deltaPointerPosition.y)) / windowHeight;
    hasMovedCamera = movedCameraAcc > 0.003;
}

let needCheckResize = true;
let safeWidth = 0;
let safeHeight = 0;
let windowWidth = 0;
let windowHeight = 0;
let safeAR = 1;
function checkWindowResize() {
    let safeareawidth = safearea.offsetWidth;
    let safeareaheight = safearea.offsetHeight;
    if (safeWidth != safeareawidth || safeHeight != safeareaheight || needCheckResize) {
        safeWidth = safeareawidth;
        safeHeight = safeareaheight;
        safeAR = safeareawidth / safeareaheight;
        windowWidth = window.innerWidth;
        windowHeight = window.innerHeight;

        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize(windowWidth, windowHeight, true);
        camera.aspect = windowWidth / windowHeight;
    }
}
//#endregion


//#region Timeline Display
let timeline = new timelineDisplay();

//#endregion

//#region Stats & GUI

let stats = new Stats();
stats.showPanel(1);
document.body.appendChild(stats.dom);
stats.dom.style.top = "";
stats.dom.style.bottom = "0px";
const gui = new dat.GUI({name: 'settings'});

var bgColor = gui.addColor(config.bg, "backgroundColor");
bgColor.onChange((v) => {
    scene.background.set(v);
})
gui.add(config, "daysPerSecond", 1/86400, 365);
gui.add(config, "soundVelocity", 0.01, 1, 0.01);
//gui.add(config.ux, "usabilityFactor", 0, 1);
let cameraGUI = gui.addFolder("Camera");
cameraGUI.add(config.camera, "distance", 1, 40);
cameraGUI.add(config.camera, "fov", 5, 110);
cameraGUI.add(config.camera, "rotatingSpeed", 0.01, Math.PI * 2);
cameraGUI.add(config.camera, "scrollSpeed", 0, 1, 0.001);
let sunGUI = gui.addFolder("Sun");
sunGUI.add(config.sun, "intensity", 0, 20);
let scaleGUI = gui.addFolder("Scale")
scaleGUI.add(config, "realisticScaleFactor", 0, 1);
scaleGUI.add(config, "unifiedScaleFactor", 0, 1);
scaleGUI.add(config, "unifiedScale", 1, 65);
scaleGUI.add(config, "realisticScale", 1, 65);
let uxGUI = gui.addFolder("UX");
uxGUI.add(config.ux, "cameraHeight", 3, 15);
uxGUI.add(config.ux, "marginPercentage", 0, 0.9);
uxGUI.add(config.ux, "doMousePluck");
uxGUI.add(config.ux, "planetsVsSpaceFactor", 0, 1);
uxGUI.add(config.ux, "sunSizeMultiplier", 1, 10);
uxGUI.add(config, "wantedOutlineScreenPercentage", 0.001, 0.3, 0.001);
let pluckGUI = gui.addFolder("Pluck");
pluckGUI.add(config.pluck, "attackNoise", 0.1, 1.5, 0.05);
pluckGUI.add(config.pluck, "dampening", 0, 7000);
pluckGUI.add(config.pluck, "resonance", 0, 1);
pluckGUI.add(config.pluck, "release", 0.01, 10);
let debugGUI = gui.addFolder("debug");
debugGUI.add(config.debug, "mouseStatus");
let stringGUI = gui.addFolder("strings");
stringGUI.add(config.strings, "width", 0, 0.2, 0.001);
stringGUI.add(config.strings, "fragmentWidth", 0, 0.5, 0.001);
stringGUI.add(config.strings, "fadeOutTime", 0.1, 5, 0.01);
stringGUI.add(config.strings, "fadeOutTimeFrequency", 50, 10000, 1);
stringGUI.add(config.strings, "coloredEdge", 0, 3, 0.01);
stringGUI.add(config.strings, "coloredEdgeStart", 0, 3, 0.01);
stringGUI.addColor(config.strings, "stringColor");
gui.add(config, "midiNotesTime", 0.01, 10, 0.01);
gui.close();

function toggleDebug() {
    if (gui.domElement.classList.contains('hidden'))
    {
        gui.domElement.classList.remove('hidden');
        stats.dom.classList.remove('hidden');
    }
    else {
        gui.domElement.classList.add('hidden');
        stats.dom.classList.add('hidden');
    }
}
toggleDebug();

let timeDiv = document.getElementById('timeDesc');

document.getElementById('timeSlider').oninput = function(v) {
    let val = v.target.valueAsNumber;
    config.daysPerSecond = val;
    if (val < 1)
    {
        let hours = val * 24;
        timeDiv.textContent = "time passing at "+hours.toFixed(1)+"  hours/s";
    }
    else if (val == 1)
        timeDiv.textContent = "time passing at "+val+" days/s";
    else timeDiv.textContent = "time passing at "+val+" day/s";
}

let speedDiv = document.getElementById('speedDesc');
document.getElementById('velocitySlider').oninput = function(v) {
    let val = v.target.valueAsNumber;
    config.soundVelocity = val;
    if (val >= 1)
        speedDiv.textContent = "string wave moving at c";
    else speedDiv.textContent = "string wave moving at "+(val*100).toFixed(1)+"% c";
}

//#endregion

// let colorPalleteOriginal =      [0xffb400, 0x4d0400, 0x7c790f, 0x204dc0, 0x993d00, 0xb07f35, 0xb08f36, 0x5580aa, 0x366896];
let colorPalleteOriginal2 =      [0xffb400, 0x4d0400, 0x736600, 0x0000c0, 0x993d00, 0xA06C23, 0x9C8969, 0x87A1B6, 0x6576C2];
// let colorPalleteEquidistantLAB =   [0xffb400, 0xA8001F, 0x006032, 0x2310FF, 0x923300, 0x0D6000, 0x575500, 0x005880, 0x860AB1];
// let colorPalleteEquidistantHSB =   [0xffb400, 0x730099, 0x009908, 0x0A0099, 0x990300, 0x99005C, 0x619900, 0x00996E, 0x095F99];

let colors = colorPalleteOriginal2;

//#region Scene objects

const renderer = new THREE.WebGPURenderer({canvas: canvas});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

let toneListener = null;
const toneListenerFwd = new THREE.Vector3();
const toneListenerUp = new THREE.Vector3();

const starField = new starfield(config, scene);

const textureLoader = new THREE.TextureLoader();
const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd , map: textureLoader.load("planets/sun.png")} ));
sun.color = colors[0];
sun.name = "sun";
const sunRadius = 696340;
const sunLight = new THREE.PointLight(0xfffffe, config.sun.intensity, 0, 0);
sun.add(sunLight);
scene.add( sun );
scene.background = new THREE.Color(config.bg.backgroundColor);

let selectedPlanetName = "";
let selectedPlanet = sun;
let selectedPlanetAnimTime = 0;
let prevSelectedPlanet = sun;

let nameToId = {
    sun: 0, mercury: 1, venus: 2, terra: 3, mars: 4, jupiter: 5, saturn: 6, uranus:7, neptune:8
}
let idToName = ["sun", "mercury", "venus", "terra", "mars", "jupiter", "saturn", "uranus", "neptune"];

let uxfAnimTime = 0;
let uxfAnimStart = 0;
let uxfWannabe = 0;

function setUxFriendly(friendly) {
    uxfAnimTime = 0;
    uxfAnimStart = config.ux.usabilityFactor;
    uxfWannabe = friendly? 1 : 0;
}

function onPlanetSelectedUI(name, object3D)
{    
    setUxFriendly(false);
    if (selectedPlanetName == name) return;

    //let i = nameToId[name];
    
    if (selectedPlanetName != "") {
        let oldPlanetDiv = document.getElementById(selectedPlanetName);
        //oldPlanetDiv.textContent = "["+idToName.indexOf(selectedPlanetName)+"] "+selectedPlanetName;
        oldPlanetDiv.style.borderStyle = "dotted";
        oldPlanetDiv.style.borderWidth = "2px";
    }
    let planetDiv = document.getElementById(name);
    //planetDiv.textContent = "< ["+i+"] "+name+" >";
    planetDiv.style.borderStyle = "solid";
    planetDiv.style.opacity = 1;
    planetDiv.style.borderWidth = "4px";

    selectedPlanetName = name;

    prevSelectedPlanet = selectedPlanet;
    selectedPlanet = object3D;
    selectedPlanetAnimTime = 0;
}

function registerPlanetOnUi(name, object3D)
{
    let i = idToName.indexOf(name);
    let planetSelector = document.createElement("p");
    planetSelector.classList.add("planet");
    planetSelector.id = name;
    planetSelector.textContent = `[${i}] ${name}`;
    let color = new THREE.Color(object3D.color);
    planetSelector.style.borderColor = `#${color.getHexString()}`;
    planetSelector.style.opacity = 0.7;
    planetSelector.addEventListener('pointerdown', () => onPlanetSelectedUI(name, object3D));
    document.getElementById("planets").appendChild(planetSelector);
}

registerPlanetOnUi("sun", sun);
onPlanetSelectedUI("sun", sun);


camera.position.z = config.camera.z;
camera.position.y = config.camera.y;
camera.lookAt(sun.position);

let planets = [];

let mercury = new planet("mercury", 2439.4, colors[planets.length + 1], scene, 2, 176, textureLoader, 'planets/mercury.jpg', 'planets/mercurynormal.jpg');
mercury.setKeplerianElements(0.38709843, 0, 0.20563661, 0.00002123, 7.00559432, -0.00590158, 252.2516672, 149472.6749, 77.45771895, 0.15940013, 48.33961819, -0.12214182);
planets.push(mercury);
registerPlanetOnUi("mercury", mercury.mesh);

let venus = new planet("venus", 6051.8, colors[planets.length + 1], scene, 177, 242, textureLoader, 'planets/venus.jpg');
venus.setKeplerianElements(0.72332102, -0.00000026, 0.00676399, -0.00005107, 3.39777545, 0.00043494, 181.9797085, 58517.8156, 131.7675571, 0.05679648, 76.67261496, -0.27274174);
planets.push(venus);
registerPlanetOnUi("venus", venus.mesh);

let terra = new planet("terra", 6371.0084, colors[planets.length + 1], scene, 23.5, 1, textureLoader, 'planets/earth.jpg');
terra.setKeplerianElements(1.00000018, -0.00000003, 0.01673163, -0.00003661, -0.00054346, -0.01337178, 100.4669157, 35999.37306, 102.9300589, 0.3179526, -5.11260389, -0.24123856);
planets.push(terra);
registerPlanetOnUi("terra", terra.mesh);

let mars = new planet("mars", 3389.50, colors[planets.length + 1], scene, 25, 1.027, textureLoader, 'planets/mars.jpg');
mars.setKeplerianElements(1.52371243, 0.00000097, 0.09336511, 0.00009149, 1.85181869, -0.00724757, -4.56813164, 19140.29934, -23.91744784, 0.45223625, 49.71320984, -0.26852431);
planets.push(mars);
registerPlanetOnUi("mars", mars.mesh);

let jupiter = new planet("jupiter", 69911, colors[planets.length + 1], scene, 3, 10/24, textureLoader, 'planets/jupiter.jpg');
jupiter.setKeplerianElements(5.20248019, -0.00002864, 0.0485359, 0.00018026, 1.29861416, -0.00322699, 34.33479152, 3034.903718, 14.27495244, 0.18199196, 100.2928265, 0.13024619);
jupiter.setAdditionalTerms(-0.00012452, 0.06064060, -0.35635438, 38.35125000);
planets.push(jupiter);
registerPlanetOnUi("jupiter", jupiter.mesh);

let saturn = new planet("saturn", 58232, colors[planets.length + 1], scene, 26, 10.65/24, textureLoader, 'planets/saturn.jpg', undefined, 'planets/saturnring.png', config.rings.saturnRingSize, config.rings.saturnRingStart);
saturn.setKeplerianElements(9.54149883, -0.00003065, 0.05550825, -0.00032044, 2.49424102, 0.00451969, 50.07571329, 1222.114947, 92.86136063, 0.54179478, 113.639987, -0.25015002);
saturn.setAdditionalTerms(0.00025899, -0.13434469, 0.87320147, 38.35125000);
planets.push(saturn);
registerPlanetOnUi("saturn", saturn.mesh);

let uranus = new planet("uranus", 25362, colors[planets.length + 1], scene, 97, 0.718055, textureLoader, 'planets/uranus.jpg', undefined, 'planets/uranusring.png', config.rings.uranusRingSize, config.rings.uranusRingStart);
uranus.setKeplerianElements(19.18797948, -0.00020455, 0.0468574, -0.0000155, 0.77298127, -0.00180155, 314.2027663, 428.495126, 72.4340444, 0.09266985, 73.96250215, 0.05739699);
uranus.setAdditionalTerms(0.00058331, -0.97731848, 0.17689245, 7.67025000);
planets.push(uranus);
registerPlanetOnUi("uranus", uranus.mesh);

let neptune = new planet("neptune", 24622, colors[planets.length + 1], scene, 29.6, 16/24, textureLoader, 'planets/neptune.jpg');
neptune.setKeplerianElements(30.06952752, 0.00006447, 0.00895439, 0.00000818, 1.7700552, 0.000224, 304.2228929, 218.4651531, 46.68158724, 0.01009938, 131.7863585, -0.00606302);
neptune.setAdditionalTerms(-0.00041348, 0.68346318, -0.10162547, 7.67025000);
planets.push(neptune);
registerPlanetOnUi("neptune", neptune.mesh);


let timeMS = Date.now();
let accTimeMS = 0;
let accTimeDays = 0;

let timeDisplay = new Date();
let timeDisplayDiv = document.getElementById("currentTime");
let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// const synth = new Tone.MonoSynth({
//     oscillator: {
//         type: "sawtooth"
//     },
//     envelope: {
//         attack: config.synth.attack,
//         decay: config.synth.decay,
//         sustain: config.synth.sustain,
//         release: config.synth.release
//     },
//     volume: config.synth.volume
// }).toDestination();
// const synth2 = new Tone.PluckSynth(config.pluck).toDestination();

// let synthCountdown = 0;
// let synthCounter = 0;

// Strings:
let strings = [];
let stringsMap = {};
function registerString(i, j, string)
{
    if (hasString(i,j)) return;

    if (stringsMap[i] == null) stringsMap[i] = {};
    if (stringsMap[j] == null) stringsMap[j] = {};
    stringsMap[i][j] = stringsMap[j][i] = string;
    string.midi = {playing: false, note: 0, time:0};
    strings.push(string);
    timeline.addString(string);
}
function hasString(i, j)
{
    if (i == j) return true;
    return (stringsMap[i] != null && stringsMap[i][j] != null)
        || (stringsMap[j] != null && stringsMap[j][i] != null);
}
function removeString(i,j,string)
{
    strings.splice(strings.indexOf(string), 1);
    stringsMap[i][j] = null;
    stringsMap[j][i] = null;
    timeline.removeString(string);
    string.dispose();
}
function onNotePlayed (string, fromName, toName, player, simulationFrequency) {
    if (currentMidiOutput != null)
    {
        let midiNote = Tone.Frequency(simulationFrequency).toMidi();
        if (midiNote >= 0 && midiNote < 128) {
            if (string.midi.playing)
            {
                currentMidiOutput.send([0x80, midiNote, 0x40]) // NoteOff, Note, Velocity
            }
            currentMidiOutput.send([0x90, midiNote, 0x40]) // NoteOn, Note, Velocity
            // Metadata for releasing
            string.midi.note = midiNote;
            string.midi.time = accTimeMS/1000;
            string.midi.playing = true;
        }
    }

    timeline.onNotePlayed(string, fromName, toName, player, simulationFrequency);

}
function createString(i,j)
{
    let planetIReal = i == 0? sun : planets[i-1].realObject;
    let planetIVisual = i == 0? sun : planets[i-1].mesh;
    let planetJReal = j == 0? sun : planets[j-1].realObject;
    let planetJVisual = j == 0? sun : planets[j-1].mesh;
    // console.log("making string between", i, j);
    let string = new stellarString(config, scene, planetIReal, planetJReal, white, allCares, planetIVisual, planetJVisual, onNotePlayed, i, j);
    registerString(i, j, string);
}

let interactables = [];
let white = new THREE.Color(0xffffff);
interactables.push(sun);
planets.forEach((p) => {
    interactables.push(p.mesh);
    p.realObject.plucking = true;
});

// mouse viz and debug
let pointerViz = new THREE.Mesh( new THREE.SphereGeometry( 1, 64 ), new THREE.MeshBasicMaterial( { color: 0x00ff00, side: THREE.BackSide } ) );
pointerViz.visible = false;
scene.add(pointerViz);
let pointerFollow = null;

let mousePluck = new THREE.Object3D("mouse");
// mousePluck.add(pointerViz);
// mousePluck.children[0].visible = config.debug.mouseStatus;
scene.add( mousePluck );
mousePluck.plucking = config.ux.doMousePluck;
mousePluck.color = 0xffffff;
let allCares = [mousePluck, sun];
sun.plucking = true;
for (let i = 0; i < planets.length; ++i)
{
    allCares.push(planets[i].realObject);
}

function deleteAllStringsFromSelected() {
    let i = idToName.indexOf(selectedPlanetName);
    for (let j = 0; j < idToName.length; ++j)
    {
        if (i != j && hasString(i,j))
            removeString(i,j,stringsMap[i][j]);
    }
}

function addAllStringsFromSelected() {
    let i = idToName.indexOf(selectedPlanetName);
    for (let j = 0; j < idToName.length; ++j)
    {
        if (i != j && !hasString(i,j))
            createString(i,j);
    }
}

function toggleUxFriendly() {
    setUxFriendly(uxfWannabe == 0? true : false);
}

function toggleOrbits() {
    config.orbitsVisible = !config.orbitsVisible;
    planets.forEach(planet => {
        planet.orbit.visible = config.orbitsVisible;
    });
}

function toggleTimeline() {
    timeline.toggleShow();
}

let currentMidiOutput = null;
async function requestMIDI() {
  const access = await navigator.requestMIDIAccess();
  const outputs = access.outputs.values();
  if (outputs.size == 0)
  {
    console.log("no midi outputs found");
  }
  else {
    document.getElementById("midi").classList.add("hidden");
    let midiOutputsDiv = document.getElementById("outputs");
    midiOutputsDiv.classList.remove("hidden");

    outputs.forEach((o) =>
    {
        let outputDiv = document.createElement("p");
        outputDiv.classList.add("actions");
        outputDiv.textContent = `output midi to ${o.name}`;
        outputDiv.addEventListener("pointerdown", () => {
            o.open().then(() => {
                if (currentMidiOutput != null)
                    currentMidiOutput.close();
                currentMidiOutput = o;
                outputDiv.textContent = `sending midi to ${o.name}`;
            });
        });
        midiOutputsDiv.appendChild(outputDiv);
    });
  }
}


//#region Keyboard Controls
document.addEventListener('keydown', (ev) => {
    if (ev.key == '0') onPlanetSelectedUI("sun", sun);
    else if (ev.key == '1') onPlanetSelectedUI("mercury", mercury.mesh);
    else if (ev.key == '2') onPlanetSelectedUI("venus", venus.mesh);
    else if (ev.key == '3') onPlanetSelectedUI("terra", terra.mesh);
    else if (ev.key == '4') onPlanetSelectedUI("mars", mars.mesh);
    else if (ev.key == '5') onPlanetSelectedUI("jupiter", jupiter.mesh);
    else if (ev.key == '6') onPlanetSelectedUI("saturn", saturn.mesh);
    else if (ev.key == '7') onPlanetSelectedUI("uranus", uranus.mesh);
    else if (ev.key == '8') onPlanetSelectedUI("neptune", neptune.mesh);
    else if (ev.key == 'Delete' || ev.key == 'Backspace') {
        deleteAllStringsFromSelected();
    }
    else if (ev.key == 'a') {
        addAllStringsFromSelected();
    }
    else if (ev.key == ' ')
    {
        toggleUxFriendly();
    }
    else if (ev.key == 'd')
    {
        toggleDebug();
    }
    else if (ev.key == 'o')
    {
        toggleOrbits();
    }
    else if (ev.key == 't')
    {
        toggleTimeline();
    }
    else if (ev.key == 'm')
    {
        requestMIDI();
    }
    else if (ev.key == 'ArrowLeft')
    {

    }
    else if (ev.key == 'ArrowRight')
    {

    }
    else if (ev.key == 'ArrowDown')
    {

    }
    else if (ev.key == 'ArrowUp')
    {

    }
    //else console.log(ev.key);
});

document.getElementById("delete").addEventListener("pointerdown", deleteAllStringsFromSelected);
document.getElementById("orbit").addEventListener("pointerdown", toggleOrbits);
document.getElementById("all").addEventListener("pointerdown", addAllStringsFromSelected);
document.getElementById("space").addEventListener("pointerdown", toggleUxFriendly);
document.getElementById("timelineToggle").addEventListener("pointerdown", toggleTimeline);
document.getElementById("midi").addEventListener("pointerdown", requestMIDI);
//#endregion

//#region Pointer interaction
let lastPointerPosition = new THREE.Vector2();
let pointerPosition = new THREE.Vector2();
let deltaPointerPosition = new THREE.Vector2();
let pointerNormalizedPosition = new THREE.Vector2();
let pointerDown = false;
let pointerWasDown = false;
let buildingString = false;
let stringBeingBuild = null;
function processPointer(ev) {
    lastPointerPosition.copy(pointerPosition);
    let rect = canvas.getBoundingClientRect();
    pointerPosition.x = ev.clientX - rect.left;
    pointerPosition.y = ev.clientY - rect.top;
    pointerNormalizedPosition.x = pointerPosition.x / windowWidth * 2 - 1;
    pointerNormalizedPosition.y = pointerPosition.y / windowHeight * 2 - 1;
    pointerNormalizedPosition.y *= -1;
    if (!pointerWasDown && pointerDown)
        lastPointerPosition.copy(pointerPosition);
    deltaPointerPosition.subVectors(pointerPosition, lastPointerPosition);
    pointerWasDown = pointerDown;
}

let pointerClosestInteractable = -1;
let pointerClosestInteractableDistance = 10000000;
function checkObjectBelowPointer()
{
    mouseRaycaster.setFromCamera(pointerNormalizedPosition, camera);

    pointerClosestInteractable = -1;
    pointerClosestInteractableDistance = 1000000000;
    for (let i = 0; i < interactables.length; ++i)
    {
        let d = mouseRaycaster.ray.distanceSqToPoint(interactables[i].position);
        let c = camera.position.distanceToSquared(interactables[i].position);
        //console.log(i, d, c, d / c);
        if (d / c < pointerClosestInteractableDistance)
        {
            pointerClosestInteractableDistance = d / c;
            pointerClosestInteractable = i;
        }
    }

    return pointerClosestInteractableDistance < 0.001;
}

let lastClickedInteractable = -1;
function checkPointerInteraction() {
    
    let hasClickedInteractable = checkObjectBelowPointer();
    let closestInteractable = pointerClosestInteractable;

    if (buildingString)
    {
        if (pointerDown && (!hasClickedInteractable || lastClickedInteractable == closestInteractable)) {
            buildingString = false;
            //console.log("cancelling string");
            stringBeingBuild.dispose();
            stringBeingBuild = null;
            lastClickedInteractable = -1;
        }
        else if (hasClickedInteractable)
        {
            let alreadyString = hasString(lastClickedInteractable, closestInteractable);
            if (pointerDown && alreadyString)
            {
                removeString(lastClickedInteractable, closestInteractable, stringsMap[lastClickedInteractable][closestInteractable]);
                //console.log("removing string between", lastClickedInteractable, closestInteractable);
                stringBeingBuild.dispose();
                stringBeingBuild = null;
                buildingString = false;
                lastClickedInteractable = -1;
            }
            else if (!alreadyString) {
                createString(closestInteractable, lastClickedInteractable);
                stringBeingBuild.dispose();
                stringBeingBuild = null;
                buildingString = false;
                lastClickedInteractable = -1;
            }
        }
    }
    else {
        if (hasClickedInteractable && pointerDown) {
            buildingString = true;
            wasBuildingString = true;
            uxfAnimTime = 0;
            uxfAnimStart = config.ux.usabilityFactor;
            lastClickedInteractable = closestInteractable;

            stringBeingBuild = new stellarString(config, scene, interactables[lastClickedInteractable], mousePluck, white, []);
            
            if (uxfWannabe != 1) {
                setUxFriendly(true);
            }
        }
        else if (!hasMovedCamera && !wasBuildingString && !pointerDown && !hasClickedInteractable) {
            setUxFriendly(uxfWannabe == 0? true : false);
        }
    }
}


// TODO check ev.pointerType to improve UX on touch screens
canvas.addEventListener('pointermove', function(ev) {
    processPointer(ev);
    if (pointerDown && !buildingString)
    {
        moveCamera(ev);
        canvas.style.cursor = "auto";
        pointerViz.visible = false;
    }
    else {
        let thereIsObject = checkObjectBelowPointer();
        if (thereIsObject) {
            canvas.style.cursor = "pointer";

            pointerFollow = interactables[pointerClosestInteractable];
            pointerViz.visible = true;
            if (pointerClosestInteractable == 0) // sun
                pointerViz.material.color.setHex(0xffffff);
            else pointerViz.material.color.setHex(interactables[pointerClosestInteractable].color);
        }
        else {
            canvas.style.cursor = "auto";
            pointerViz.visible = false;
        }
    }
});
canvas.addEventListener('pointerdown', function(ev) {
    pointerDown = true;
    movedCameraAcc = 0;
    processPointer(ev);
    checkPointerInteraction();
});
canvas.addEventListener('pointerup', function (ev) {
    pointerDown = false;
    processPointer(ev);
    checkPointerInteraction();
    hasMovedCamera = false;
    wasBuildingString = buildingString;
});
document.addEventListener('wheel', function(ev) {
    config.camera.distance = THREE.MathUtils.clamp(config.camera.distance + ev.deltaY * config.camera.scrollSpeed, 0.2, 100);
});
//#endregion

function deformPositionBasedOnPlanets(pos)
{
    let realDistanceFromSun = pos.length();
    let j = -1;
    for (let i = 0; i < planets.length; ++i) {
        let p = planets[i];
        if (realDistanceFromSun <= p.realDistanceFromSun)
        {
            j = i;
            break;
        }
    }
    if (j == -1) { // farther than furthest plannet
        let prev = planets[planets.length - 1];
        let furtherAmount = realDistanceFromSun - prev.realDistanceFromSun;
        pos.normalize().multiplyScalar(prev.visualDistanceFromSun + furtherAmount);
    }
    else if (j == 0) { // betrween sun and mercury
        let next = planets[j];
        let f = realDistanceFromSun / next.realDistanceFromSun;
        pos.normalize().multiplyScalar(f * next.visualDistanceFromSun);
    }
    else {
        let prev = planets[j - 1];
        let next = planets[j];
        let f = (realDistanceFromSun - prev.realDistanceFromSun) / (next.realDistanceFromSun - prev.realDistanceFromSun);
        
        let visualDistanceBetweenOrbits = next.visualDistanceFromSun - prev.visualDistanceFromSun;
        pos.normalize().multiplyScalar(prev.visualDistanceFromSun + f * visualDistanceBetweenOrbits);
    }
}
//#endregion

//#region Update
// UXF stands for UX-friendly
let mouseRaycaster = new THREE.Raycaster();
let pointerInteractionPlane = new THREE.Plane(new THREE.Vector3(0,1, 0), 0);
let uxfCameraPosition = new THREE.Vector3();
let uxfCameraQuaternion = new THREE.Quaternion();
function animate() {
    stats.begin();
    checkWindowResize()

    let currentTimeMS = Date.now();
    let deltaTime = currentTimeMS - timeMS;
    timeMS = currentTimeMS;
    accTimeMS += deltaTime;
    let deviceTime = accTimeMS/1000;
    accTimeDays += deltaTime/1000 * config.daysPerSecond;

    if (uxfAnimTime >= 0) {
        uxfAnimTime += deltaTime/1000;
        let t = uxfAnimTime / config.ux.cameraAnimationTotalTime;
        config.ux.usabilityFactor = THREE.MathUtils.lerp(uxfAnimStart, uxfWannabe, THREE.MathUtils.smootherstep(t, 0, 1));
        if (t >= 1) {
            uxfAnimTime = -1;
        }
    }

    let uf = config.ux.usabilityFactor;
    if (selectedPlanetAnimTime >= 0)
    {
        selectedPlanetAnimTime += deltaTime/1000;
        let t = Math.min(1, selectedPlanetAnimTime / config.ux.cameraAnimationTotalTime);
        if (t >= 1) selectedPlanetAnimTime = -1;
        cameraRotatingPivot.position.copy(prevSelectedPlanet.position).lerp(selectedPlanet.position, THREE.MathUtils.smootherstep(t, 0, 1));
    }
    else cameraRotatingPivot.position.copy(selectedPlanet.position);

    cameraDistancePivot.position.z = config.camera.distance;

    cameraDistancePivot.getWorldPosition(camera.position);
    camera.position.lerp(camUxfPos, uf);
    camera.quaternion.copy(cameraDistancePivot.quaternion);
    camera.quaternion.slerp(camUxfQuat, uf);
    camera.fov = config.camera.fov;
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();    

    uxfCameraPosition.copy(camera.position).sub(cameraRotatingPivot.position);
    let cameraDistanceFactor = Math.max(1, uxfCameraPosition.length()/config.ux.cameraHeight);
    config.strings.stringWidth = config.strings.width * cameraDistanceFactor;

    mousePluck.plucking = config.ux.doMousePluck;
    mouseRaycaster.setFromCamera(pointerNormalizedPosition, camera);
    mouseRaycaster.ray.intersectPlane(pointerInteractionPlane, mousePluck.position); // this sets the mousePluck position, used by when building strings to visualize

    sunLight.intensity = config.sun.intensity;

    let cameraHalfHeight = camera.position.y * Math.tan(config.camera.fov * 0.5 * THREE.MathUtils.DEG2RAD);
    let cameraHalfWidth = cameraHalfHeight * safeAR;

    let maxUxRadius = cameraHalfHeight;
    if (safeAR < 1) {
        maxUxRadius *= safeAR;

        let safePercentage = safeWidth / windowWidth;
        maxUxRadius *= safePercentage;
    }
    else {
        let safePercentage = safeHeight / windowHeight;
        maxUxRadius *= safePercentage;
    }
    maxUxRadius -= maxUxRadius * config.ux.marginPercentage;

    // compute UX friendly sizes (for mouse interaction)
    let uxfSpaceForPlanets = maxUxRadius * config.ux.planetsVsSpaceFactor;
    let uxfPlanetRadius = uxfSpaceForPlanets / (planets.length * 2 - 1 + 1 * config.ux.sunSizeMultiplier);
    let uxfSunRadius = uxfPlanetRadius * config.ux.sunSizeMultiplier;
    let uxfSpaceAmount = maxUxRadius - uxfSpaceForPlanets;
    let uxfSpaceBetweenPlanets = uxfSpaceAmount / planets.length;
    let uxfSpaceStart = uxfSunRadius + uxfSpaceBetweenPlanets + uxfPlanetRadius;
    // let uxfSpaceEnd = maxUxRadius - uxfPlanetRadius;


    // actually update sun and planets
    let sunSize = lerp(sunRadius / AU, config.unifiedScale, config.unifiedScaleFactor);
    let directSunScaledSize = config.realisticScale * sunRadius / AU;
    sunSize = lerp(sunSize, directSunScaledSize, config.realisticScaleFactor);
    sunSize = lerp(sunSize, uxfSunRadius, config.ux.usabilityFactor);
    sun.scale.set(sunSize,sunSize,sunSize);
    sun.quaternion.setFromAxisAngle(VECTOR3.UP, accTimeDays * Math.PI * 2 / 25.67);

    for (let i = 0; i < planets.length; ++i) {
        let p = planets[i];
        let uxfRadius = uxfSpaceStart + i * (uxfSpaceBetweenPlanets + uxfPlanetRadius * 2);//(i + 1) * maxUxRadius / planets.length;
        p.computeCoordinates(accTimeDays);
        
        let size = lerp(p.radius / AU, config.unifiedScale, config.unifiedScaleFactor);
        let directScaledSize = config.realisticScale * p.radius / AU;
        size = lerp(size, directScaledSize, config.realisticScaleFactor);
        size = lerp(size, uxfPlanetRadius, config.ux.usabilityFactor);

        p.update(uxfRadius, config.ux.usabilityFactor, config.rings, size);
    }

    if (stringBeingBuild != null) {
        stringBeingBuild.update(audioReady, accTimeMS, deltaTime, (v) => v, camera);
    }
    strings.forEach((s) => {
        s.update(audioReady, accTimeMS, deltaTime, deformPositionBasedOnPlanets, camera);

        // midi release
        if (s.midi.playing)
        {
            if (deviceTime - s.midi.time >= config.midiNotesTime) {
                if (currentMidiOutput != null) currentMidiOutput.send([0x80, s.midi.note, 0x40]) // NoteOff
                s.midi.playing = false;
            }
        }
    });

    if (pointerViz.visible && pointerFollow != null) {
        pointerViz.position.copy(pointerFollow.position);
        let distance = uxfCameraPosition.copy(camera.position).sub(pointerViz.position).length();
        let followSize = pointerFollow.scale.x;
        let followSizeAngleOnScreen = Math.atan(followSize / distance) * THREE.MathUtils.RAD2DEG;
        let followScreenPercentage = followSizeAngleOnScreen / (camera.fov / 2);

        let wantedScreenPercentage = followScreenPercentage + config.wantedOutlineScreenPercentage;
        let tan = Math.tan(wantedScreenPercentage * (camera.fov * THREE.MathUtils.DEG2RAD / 2));
        let size = tan * distance;

        pointerViz.scale.set(size, size, size);
    }

    renderer.render( scene, camera );

    if (audioReady) {
        toneListener.positionX.value = camera.position.x;
        toneListener.positionY.value = camera.position.y;
        toneListener.positionZ.value = camera.position.z;
        camera.getWorldDirection(toneListenerFwd);
        toneListener.forwardX.value = toneListenerFwd.x;
        toneListener.forwardY.value = toneListenerFwd.y;
        toneListener.forwardZ.value = toneListenerFwd.z;
        toneListener.upX.value = camera.up.x;
        toneListener.upY.value = camera.up.y;
        toneListener.upZ.value = camera.up.z;
    }
    
    stats.end();

    let timeDaysShift = terra.offsetTime;// -5000 * 365; // start at 3000 BC

    timeDisplay.setTime((accTimeDays + timeDaysShift) * 86400000 + 946727967000) // Convert accumulated days since J2000 to UTC ms timestamp (approx) // 946727967
    timeDisplayDiv.textContent = timeDisplay.getDate() + " "+ monthNames[timeDisplay.getMonth()] + " "+ timeDisplay.getFullYear();//timeDisplay.toDateString();//.toLocaleDateString();
    
    if (timeline.isShowing) timeline.update(strings, accTimeMS/1000);
}
renderer.setAnimationLoop( animate );