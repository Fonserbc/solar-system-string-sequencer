import * as THREE from 'three/webgpu';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import planet from './planet';
import { AU } from './constants';
import { lerp } from 'three/src/math/MathUtils';
import * as dat from 'dat.gui';
import * as Tone from 'tone';
import stellarString from './stellarString';
import starfield from './starfield';
import Stats from 'stats.js';

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
    }
}
//#endregion

//#region Setup & camera
let audioReady = false;
const canvas = document.getElementById("canvas");
canvas.addEventListener("pointerdown", async () => {
    if (!audioReady) {
        await Tone.start();
        audioReady = true;
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
function moveCamera(ev) {
    let x = deltaPointerPosition.x*config.camera.rotatingSpeed/windowHeight;
    let y = deltaPointerPosition.y*config.camera.rotatingSpeed/windowHeight;
    cameraAngles.x += y;
    cameraAngles.x = THREE.MathUtils.clamp(cameraAngles.x + y, -maxXCameraAngle, maxXCameraAngle);
    cameraAngles.y -= x;

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

    // camMovementVec.copy(VECTOR3.DOWN);//.applyQuaternion(cameraRotatingPivot.quaternion);
    // camMovementQuat.setFromAxisAngle(camMovementVec, x);
    // cameraRotatingPivot.quaternion.multiply(camMovementQuat);
    // camMovementVec.copy(VECTOR3.RIGHT);//.applyQuaternion(cameraRotatingPivot.quaternion);
    // camMovementQuat.setFromAxisAngle(camMovementVec, y);
    // cameraRotatingPivot.quaternion.multiply(camMovementQuat);
    // cameraDistancePivot.quaternion.copy(cameraRotatingPivot.quaternion);
    hasMovedCamera = true;
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

        renderer.setSize(windowWidth, windowHeight, true);
        camera.aspect = windowWidth / windowHeight;
    }
}
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
// let synthGUI = gui.addFolder("Synth");
// synthGUI.add(config.synth, "attack", 0, 2);
// synthGUI.add(config.synth, "decay", 0, 2);
// synthGUI.add(config.synth, "sustain", 0, 1);
// synthGUI.add(config.synth, "release", 0, 2);
// synthGUI.add(config.synth, "volume", 0, 1);
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
// let ringsGUI = gui.addFolder("rings");
// ringsGUI.add(config.rings, "saturnRingSize", 0, 4);
// ringsGUI.add(config.rings, "saturnRingStart", 0, 1, 0.01);
// ringsGUI.add(config.rings, "uranusRingSize", 0, 4);
// ringsGUI.add(config.rings, "uranusRingStart", 0, 1, 0.01);
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

//#region Scene objects

const renderer = new THREE.WebGPURenderer({canvas: canvas});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const starField = new starfield(config, scene);

const textureLoader = new THREE.TextureLoader();
const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd , map: textureLoader.load("data/planets/sun.png")} ));
sun.color = 0xffb400;
sun.name = "sun";
const sunRadius = 696340;
const sunLight = new THREE.PointLight(0xfffffe, config.sun.intensity, 0, 0);
sun.add(sunLight);
scene.add( sun );
scene.background = new THREE.Color(config.bg.backgroundColor);

let selectedPlanetName = "sun";
let selectedPlanet = sun;
let selectedPlanetAnimTime = 0;
let prevSelectedPlanet = sun;

let nameToId = {
    sun: 0, mercury: 1, venus: 2, earth: 3, mars: 4, jupiter: 5, saturn: 6, uranus:7, neptune:8
}
let idToName = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];

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

    let i = idToName.indexOf(name);
    
    document.getElementById(selectedPlanetName).textContent = "["+idToName.indexOf(selectedPlanetName)+"] "+selectedPlanetName;
    document.getElementById(name).textContent = "< ["+i+"] "+name+" >";
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
    if (selectedPlanetName == name)
        planetSelector.textContent = "< ["+i+"] "+name+" >";
    else planetSelector.textContent = "["+i+"] "+name;
    planetSelector.addEventListener('pointerdown', () => onPlanetSelectedUI(name, object3D));
    document.getElementById("planets").appendChild(planetSelector);
}

registerPlanetOnUi("sun", sun);

onPlanetSelectedUI("sun", sun);


camera.position.z = config.camera.z;
camera.position.y = config.camera.y;
camera.lookAt(sun.position);

let planets = [];

let mercury = new planet("mercury", 2439.4, 0x4d0400, scene, 2, 176, textureLoader, 'data/planets/mercury.jpg', 'data/planets/mercurynormal.jpg');
mercury.setKeplerianElements(0.38709843, 0, 0.20563661, 0.00002123, 7.00559432, -0.00590158, 252.2516672, 149472.6749, 77.45771895, 0.15940013, 48.33961819, -0.12214182);
planets.push(mercury);
registerPlanetOnUi("mercury", mercury.mesh);

let venus = new planet("venus", 6051.8, 0x7c790f, scene, 177, 242, textureLoader, 'data/planets/venus.jpg');
venus.setKeplerianElements(0.72332102, -0.00000026, 0.00676399, -0.00005107, 3.39777545, 0.00043494, 181.9797085, 58517.8156, 131.7675571, 0.05679648, 76.67261496, -0.27274174);
planets.push(venus);
registerPlanetOnUi("venus", venus.mesh);

let earth = new planet("earth", 6371.0084, 0x204dc0, scene, 23.5, 1, textureLoader, 'data/planets/earth.jpg');
earth.setKeplerianElements(1.00000018, -0.00000003, 0.01673163, -0.00003661, -0.00054346, -0.01337178, 100.4669157, 35999.37306, 102.9300589, 0.3179526, -5.11260389, -0.24123856);
planets.push(earth);
registerPlanetOnUi("earth", earth.mesh);

let mars = new planet("mars", 3389.50, 0x993d00, scene, 25, 1.027, textureLoader, 'data/planets/mars.jpg');
mars.setKeplerianElements(1.52371243, 0.00000097, 0.09336511, 0.00009149, 1.85181869, -0.00724757, -4.56813164, 19140.29934, -23.91744784, 0.45223625, 49.71320984, -0.26852431);
planets.push(mars);
registerPlanetOnUi("mars", mars.mesh);

let jupiter = new planet("jupiter", 69911, 0xb07f35, scene, 3, 10/24, textureLoader, 'data/planets/jupiter.jpg');
jupiter.setKeplerianElements(5.20248019, -0.00002864, 0.0485359, 0.00018026, 1.29861416, -0.00322699, 34.33479152, 3034.903718, 14.27495244, 0.18199196, 100.2928265, 0.13024619);
planets.push(jupiter);
registerPlanetOnUi("jupiter", jupiter.mesh);

let saturn = new planet("saturn", 58232, 0xb08f36, scene, 26, 10.65/24, textureLoader, 'data/planets/saturn.jpg', undefined, 'data/planets/saturnring.png', config.rings.saturnRingSize, config.rings.saturnRingStart);
saturn.setKeplerianElements(9.54149883, -0.00003065, 0.05550825, -0.00032044, 2.49424102, 0.00451969, 50.07571329, 1222.114947, 92.86136063, 0.54179478, 113.639987, -0.25015002);
planets.push(saturn);
registerPlanetOnUi("saturn", saturn.mesh);

let uranus = new planet("uranus", 25362, 0x5580aa, scene, 97, 0.718055, textureLoader, 'data/planets/uranus.jpg', undefined, 'data/planets/uranusring.png', config.rings.uranusRingSize, config.rings.uranusRingStart);
uranus.setKeplerianElements(19.18797948, -0.00020455, 0.0468574, -0.0000155, 0.77298127, -0.00180155, 314.2027663, 428.495126, 72.4340444, 0.09266985, 73.96250215, 0.05739699);
planets.push(uranus);
registerPlanetOnUi("uranus", uranus.mesh);

let neptune = new planet("neptune", 24622, 0x366896, scene, 29.6, 16/24, textureLoader, 'data/planets/neptune.jpg');
neptune.setKeplerianElements(30.06952752, 0.00006447, 0.00895439, 0.00000818, 1.7700552, 0.000224, 304.2228929, 218.4651531, 46.68158724, 0.01009938, 131.7863585, -0.00606302);
planets.push(neptune);
registerPlanetOnUi("neptune", neptune.mesh);


let timeMS = Date.now();
let accTimeMS = 0;
let accTimeDays = 0;

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
    strings.push(string);
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
    string.dispose();
}
function createString(i,j)
{
    let planetIReal = i == 0? sun : planets[i-1].realObject;
    let planetIVisual = i == 0? sun : planets[i-1].mesh;
    let planetJReal = j == 0? sun : planets[j-1].realObject;
    let planetJVisual = j == 0? sun : planets[j-1].mesh;
    console.log("making string between", i, j);
    let string = new stellarString(config, scene, planetIReal, planetJReal, white, allCares, planetIVisual, planetJVisual);
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
let mousePluck = new THREE.Object3D("mouse");
mousePluck.add(new THREE.Mesh( new THREE.BoxGeometry( 0.1, 0.1, 0.1 ), new THREE.MeshBasicMaterial( { color: 0x00ff00 } ) ));
mousePluck.children[0].visible = config.debug.mouseStatus;
scene.add( mousePluck );
mousePluck.plucking = config.ux.doMousePluck;
mousePluck.color = 0xffffff;
let allCares = [mousePluck, sun];
sun.plucking = true;
for (let i = 0; i < planets.length; ++i)
{
    allCares.push(planets[i].realObject);
}

//#region Keyboard Controls
document.addEventListener('keydown', (ev) => {
    if (ev.key == '0') onPlanetSelectedUI("sun", sun);
    else if (ev.key == '1') onPlanetSelectedUI("mercury", mercury.mesh);
    else if (ev.key == '2') onPlanetSelectedUI("venus", venus.mesh);
    else if (ev.key == '3') onPlanetSelectedUI("earth", earth.mesh);
    else if (ev.key == '4') onPlanetSelectedUI("mars", mars.mesh);
    else if (ev.key == '5') onPlanetSelectedUI("jupiter", jupiter.mesh);
    else if (ev.key == '6') onPlanetSelectedUI("saturn", saturn.mesh);
    else if (ev.key == '7') onPlanetSelectedUI("uranus", uranus.mesh);
    else if (ev.key == '8') onPlanetSelectedUI("neptune", neptune.mesh);
    else if (ev.key == 'Delete' || ev.key == 'Backspace') {
        let i = idToName.indexOf(selectedPlanetName);
        for (let j = 0; j < idToName.length; ++j)
        {
            if (i != j && hasString(i,j))
                removeString(i,j,stringsMap[i][j]);
        }
    }
    else if (ev.key == 'a') {
        let i = idToName.indexOf(selectedPlanetName);
        for (let j = 0; j < idToName.length; ++j)
        {
            if (i != j && !hasString(i,j))
                createString(i,j);
        }
    }
    else if (ev.key == ' ')
    {
        setUxFriendly(uxfWannabe == 0? true : false);
    }
    else if (ev.key == 'd')
    {
        toggleDebug();
    }
    else console.log(ev.key);
});
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

let lastClickedInteractable = -1;
function checkPointerInteraction() {
    
    mouseRaycaster.setFromCamera(pointerNormalizedPosition, camera);

    let closestInteractable = -1;
    let combinedDistance = 1000000000;
    let hasClickedInteractable = false;
    for (let i = 0; i < interactables.length; ++i)
    {
        let d = mouseRaycaster.ray.distanceSqToPoint(interactables[i].position);
        let c = camera.position.distanceToSquared(interactables[i].position);
        //console.log(i, d, c, d / c);
        if (d / c < combinedDistance)
        {
            combinedDistance = d / c;
            closestInteractable = i;
        }
    }

    if (combinedDistance < 0.001)
    {
        hasClickedInteractable = true;
    }

    if (buildingString)
    {
        if (pointerDown && (!hasClickedInteractable || lastClickedInteractable == closestInteractable)) {
            buildingString = false;
            console.log("cancelling string");
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
                console.log("removing string between", lastClickedInteractable, closestInteractable);
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
    }
});
canvas.addEventListener('pointerdown', function(ev) {
    pointerDown = true;
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

//#region Update
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
    accTimeDays += deltaTime/1000 * config.daysPerSecond;

    if (uxfAnimTime >= 0) {
        uxfAnimTime += deltaTime/1000;
        let t = uxfAnimTime / config.ux.cameraAnimationTotalTime;
        config.ux.usabilityFactor = THREE.MathUtils.lerp(uxfAnimStart, uxfWannabe, THREE.MathUtils.smootherstep(t, 0, 1));
        if (t >= 1) uxfAnimTime = -1;
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
    // uxfCameraPosition.copy(camUxfPos);

    cameraDistancePivot.getWorldPosition(camera.position);
    camera.position.lerp(camUxfPos, uf);
    camera.quaternion.copy(cameraDistancePivot.quaternion);
    camera.quaternion.slerp(camUxfQuat, uf);
    // uxfCameraQuaternion.copy(camera.quaternion);
    // camera.quaternion.slerpQuaternions(cameraDistancePivot.quaternion, uxfCameraQuaternion, uf);
    //camera.lookAt(sun.position);
    camera.fov = config.camera.fov;
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    uxfCameraPosition.copy(camera.position).sub(cameraRotatingPivot.position);
    let cameraDistanceFactor = Math.max(1, uxfCameraPosition.length()/config.ux.cameraHeight);
    config.strings.stringWidth = config.strings.width * cameraDistanceFactor;

    mousePluck.plucking = config.ux.doMousePluck;
    mousePluck.children[0].visible = config.debug.mouseStatus;
    mouseRaycaster.setFromCamera(pointerNormalizedPosition, camera);
    let mouseRes = mouseRaycaster.ray.intersectPlane(pointerInteractionPlane, mousePluck.position);
    // if (mouseRes == null) {
    //     console.error("didn't intersect with plane!");
    // }
    //mousePluck.position.set(mousePosition.x/windowWidth - 0.5, 0, mousePosition.y/windowHeight - 0.5);

    sunLight.intensity = config.sun.intensity;

    let cameraHalfHeight = camera.position.y * Math.tan(config.camera.fov * 0.5 * THREE.MathUtils.DEG2RAD);
    let cameraHalfWidth = cameraHalfHeight * safeAR;
    // mousePluck.position.x *= cameraHalfWidth * 2;
    // mousePluck.position.z *= cameraHalfHeight * 2;

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
    });

    renderer.render( scene, camera );

    if (audioReady) {
        
        // synthCountdown -= deltaTime;
        // let period = 2000;

        // synth.setNote(config.frequency);

        // if (synthCountdown <= 0)
        // {
        //     synthCounter++;
        //     if (synthCounter % 2 == 0) {
        //         synth2.attackNoise = config.pluck.attackNoise;
        //         synth2.dampening = config.pluck.dampening;
        //         synth2.resonance = config.pluck.resonance;
        //         synth2.release = config.pluck.release;
        //         synth2.triggerAttack(config.frequency);
        //         synth.envelope.attack = config.synth.attack;
        //         synth.envelope.decay = config.synth.decay;
        //         synth.envelope.sustain = config.synth.sustain;
        //         synth.envelope.release = config.synth.release;
        //         synth.volume.value = config.synth.volume;
        //         //synth.triggerAttackRelease(config.frequency, "8n");
        //     }
        //     else {
        //         synth2.triggerRelease();
        //         //synth.triggerRelease();
        //     }
        //     synthCountdown += period;
        //     if (synthCountdown < 0) synthCountdown = period;
        // }
    }
    
    stats.end();
}
renderer.setAnimationLoop( animate );