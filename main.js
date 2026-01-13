import * as THREE from 'three/webgpu';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import planet from './planet';
import { AU } from './constants';
import { lerp } from 'three/src/math/MathUtils';
import * as dat from 'dat.gui';
import * as Tone from 'tone';
import stellarString from './stellarString';

// Solar system harp
// Stelar harp
// Stellar system harp
// Star system harp

// Solar System String sequencer S^4

let config = {
    daysPerSecond: 12, // 28
    soundVelocity: 0.75, // as a percentage of the speed of light, 1 = c
    unifiedScaleFactor: 0.15,
    realisticScaleFactor: 0.94,
    unifiedScale: 8,
    realisticScale: 26,
    camera: {
        fov: 75, 
        distance: 7,
        startingAngle: 30,
        rotatingSpeed: Math.PI
    },
    sun: {
        intensity:12,
    },
    bg: {
        backgroundColor: "#0a0a0a",
    },
    ux: {
        cameraHeight: 4,
        marginPercentage: 0.1,
        usabilityFactor: 0,
        doMousePluck: false,
        planetsVsSpaceFactor: 0.5,
        sunSizeMultiplier: 3,
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
    }
}

let audioReady = false;
const canvas = document.getElementById("canvas");
const safearea = document.getElementById("safe-area");

const gui = new dat.GUI({name: 'settings'});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( config.camera.fov, window.innerWidth / window.innerHeight, 0.001, 1000 );
const cameraRotatingPivot = new THREE.Object3D();
const cameraDistancePivot = new THREE.Object3D();
cameraRotatingPivot.add(cameraDistancePivot);
cameraDistancePivot.position.z = config.camera.distance;
cameraRotatingPivot.setRotationFromAxisAngle(new THREE.Vector3(-1,0,0), 15 * THREE.MathUtils.DEG2RAD);
cameraDistancePivot.quaternion.copy(cameraRotatingPivot.quaternion);
scene.add(cameraRotatingPivot);

const VECTOR3 = {
    UP: new THREE.Vector3(0,1,0),
    DOWN: new THREE.Vector3(0,-1,0),
    LEFT: new THREE.Vector3(1,0,0),
    RIGHT: new THREE.Vector3(-1,0,0),
    FORWARD: new THREE.Vector3(0,0,1),
}

let camMovementQuat = new THREE.Quaternion();
let camMovementVec = new THREE.Vector3();
function moveCamera(ev) {
    let x = deltaPointerPosition.x*config.camera.rotatingSpeed/windowHeight;
    let y = deltaPointerPosition.y*config.camera.rotatingSpeed/windowHeight;
    camMovementVec.copy(VECTOR3.DOWN);//.applyQuaternion(cameraRotatingPivot.quaternion);
    camMovementQuat.setFromAxisAngle(camMovementVec, x);
    cameraRotatingPivot.quaternion.multiply(camMovementQuat);
    camMovementVec.copy(VECTOR3.RIGHT);//.applyQuaternion(cameraRotatingPivot.quaternion);
    camMovementQuat.setFromAxisAngle(camMovementVec, y);
    cameraRotatingPivot.quaternion.multiply(camMovementQuat);
    cameraDistancePivot.quaternion.copy(cameraRotatingPivot.quaternion);
}

canvas.addEventListener("pointerdown", async () => {
    if (!audioReady) {
        await Tone.start();
        audioReady = true;
    }
});

let lastPointerPosition = new THREE.Vector2();
let pointerPosition = new THREE.Vector2();
let deltaPointerPosition = new THREE.Vector2();
let pointerNormalizedPosition = new THREE.Vector2();
let pointerDown = false;
let pointerWasDown = false;
let buildingString = false;
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
canvas.addEventListener('pointermove', function(ev) {
    processPointer(ev);
    if (pointerDown && !buildingString && config.ux.usabilityFactor == 0)
    {
        moveCamera(ev);
    }
});
canvas.addEventListener('pointerdown', function(ev) {
    pointerDown = true;
    processPointer(ev);
});
canvas.addEventListener('pointerup', function (ev) {
    pointerDown = false;
});

// const loader = new EXRLoader();
// loader.load( 'data/starmap_2020_4k.exr', (t) => {
//     t.mapping = THREE.EquirectangularReflectionMapping;
//     scene.background = t;
// });

var bgColor = gui.addColor(config.bg, "backgroundColor");
bgColor.onChange((v) => {
    scene.background.set(v);
})
gui.add(config, "daysPerSecond", 1, 365);
gui.add(config, "soundVelocity", 0.01, 1, 0.01);
gui.add(config.ux, "usabilityFactor", 0, 1);
let cameraGUI = gui.addFolder("Camera");
cameraGUI.add(config.camera, "distance", 1, 40);
cameraGUI.add(config.camera, "fov", 5, 110);
cameraGUI.add(config.camera, "rotatingSpeed", 0.01, Math.PI * 2);
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

const renderer = new THREE.WebGPURenderer({canvas: canvas});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd } ));
const sunRadius = 696340;
const sunLight = new THREE.PointLight(0xfffffe, config.sun.intensity, 0, 0);
sun.add(sunLight);
scene.add( sun );
scene.background = new THREE.Color(config.bg.backgroundColor);


camera.position.z = config.camera.z;
camera.position.y = config.camera.y;
camera.lookAt(sun.position);

let planets = [];

let mercury = new planet("mercury", 2439.4, 0x1a1a1a, scene);
mercury.setKeplerianElements(0.38709843, 0, 0.20563661, 0.00002123, 7.00559432, -0.00590158, 252.2516672, 149472.6749, 77.45771895, 0.15940013, 48.33961819, -0.12214182);
planets.push(mercury);

let venus = new planet("venus", 6051.8, 0xe6e6e6, scene);
venus.setKeplerianElements(0.72332102, -0.00000026, 0.00676399, -0.00005107, 3.39777545, 0.00043494, 181.9797085, 58517.8156, 131.7675571, 0.05679648, 76.67261496, -0.27274174);
planets.push(venus);

let earth = new planet("earth", 6371.0084, 0x2f6a69, scene);
earth.setKeplerianElements(1.00000018, -0.00000003, 0.01673163, -0.00003661, -0.00054346, -0.01337178, 100.4669157, 35999.37306, 102.9300589, 0.3179526, -5.11260389, -0.24123856);
planets.push(earth);

let mars = new planet("mars", 3389.50, 0x993d00, scene);
mars.setKeplerianElements(1.52371243, 0.00000097, 0.09336511, 0.00009149, 1.85181869, -0.00724757, -4.56813164, 19140.29934, -23.91744784, 0.45223625, 49.71320984, -0.26852431);
planets.push(mars);

let jupiter = new planet("jupiter", 69911, 0xb07f35, scene);
jupiter.setKeplerianElements(5.20248019, -0.00002864, 0.0485359, 0.00018026, 1.29861416, -0.00322699, 34.33479152, 3034.903718, 14.27495244, 0.18199196, 100.2928265, 0.13024619);
planets.push(jupiter);

let saturn = new planet("saturn", 58232, 0xb08f36, scene);
saturn.setKeplerianElements(9.54149883, -0.00003065, 0.05550825, -0.00032044, 2.49424102, 0.00451969, 50.07571329, 1222.114947, 92.86136063, 0.54179478, 113.639987, -0.25015002);
planets.push(saturn);

let uranus = new planet("uranus", 25362, 0x5580aa, scene);
uranus.setKeplerianElements(19.18797948, -0.00020455, 0.0468574, -0.0000155, 0.77298127, -0.00180155, 314.2027663, 428.495126, 72.4340444, 0.09266985, 73.96250215, 0.05739699);
planets.push(uranus);

let neptune = new planet("neptune", 24622, 0x366896, scene);
neptune.setKeplerianElements(30.06952752, 0.00006447, 0.00895439, 0.00000818, 1.7700552, 0.000224, 304.2228929, 218.4651531, 46.68158724, 0.01009938, 131.7863585, -0.00606302);
planets.push(neptune);

const furthestPlanetDistance = 30.06952752; // Neptune, in AU


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
var strings = [];

// var actors = [];
// var white = new THREE.Color(0xffffff);
// actors.push(sun);
// planets.forEach((p) => actors.push(p.mesh));
// for (let i = 0; i < actors.length; ++i) {
//     let p1 = actors[i];
//     //if (i != 2) continue;
//     for (let j = i + 1; j < actors.length; ++j)
//     {
//         strings.push(new stellarString(config, scene, actors[i], actors[j], i == 0? planets[j-1].color : white, actors));
//     }
// }

// mouse viz and debug
let mousePluck = new THREE.Object3D("mouse");
mousePluck.add(new THREE.Mesh( new THREE.BoxGeometry( 0.1, 0.1, 0.1 ), new THREE.MeshBasicMaterial( { color: 0x00ff00 } ) ));
mousePluck.children[0].visible = config.debug.mouseStatus;
scene.add( mousePluck );
mousePluck.plucking = config.ux.doMousePluck;

for (let i = 1; i < planets.length; ++i)
{
    let cares = [mousePluck];
    for (let j = i-1; j >= 0; --j) {
        cares.push(planets[j].realObject);
        planets[j].realObject.plucking = true;
    }
    let string = new stellarString(config, scene, sun, planets[i].realObject, planets[i].color, cares, sun, planets[i].mesh);
    strings.push(string);
}
//

let mouseRaycaster = new THREE.Raycaster();
let mouseInteractionPlane = new THREE.Plane(new THREE.Vector3(0,1, 0), 0);
let uxfCameraPosition = new THREE.Vector3();
let uxfCameraQuaternion = new THREE.Quaternion();
function animate() {
    checkWindowResize()

    let currentTimeMS = Date.now();
    let deltaTime = currentTimeMS - timeMS;
    timeMS = currentTimeMS;
    accTimeMS += deltaTime;
    accTimeDays += deltaTime/1000 * config.daysPerSecond;

    let uf = config.ux.usabilityFactor;

    cameraDistancePivot.position.z = config.camera.distance;
    uxfCameraPosition.set(0,config.ux.cameraHeight, uf);
    cameraDistancePivot.getWorldPosition(camera.position);
    camera.position.lerp(uxfCameraPosition, uf);
    camera.quaternion.copy(cameraDistancePivot.quaternion);
    camera.lookAt(sun.position);
    uxfCameraQuaternion.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(cameraDistancePivot.quaternion, uxfCameraQuaternion, uf);
    //camera.lookAt(sun.position);
    camera.fov = config.camera.fov;
    camera.updateProjectionMatrix();

    mousePluck.plucking = config.ux.doMousePluck;
    mousePluck.children[0].visible = config.debug.mouseStatus;
    mouseRaycaster.setFromCamera(pointerNormalizedPosition, camera);
    let mouseRes = mouseRaycaster.ray.intersectPlane(mouseInteractionPlane, mousePluck.position);
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

    for (let i = 0; i < planets.length; ++i) {
        let p = planets[i];
        let uxfRadius = uxfSpaceStart + i * (uxfSpaceBetweenPlanets + uxfPlanetRadius * 2);//(i + 1) * maxUxRadius / planets.length;
        p.computeCoordinates(accTimeDays);
        p.update(uxfRadius, config.ux.usabilityFactor);
        let size = lerp(p.radius / AU, config.unifiedScale, config.unifiedScaleFactor);
        let directScaledSize = config.realisticScale * p.radius / AU;
        size = lerp(size, directScaledSize, config.realisticScaleFactor);
        size = lerp(size, uxfPlanetRadius, config.ux.usabilityFactor);
        p.mesh.scale.set(size,size,size);
    }

    strings.forEach((s) => {
        s.update(audioReady, accTimeMS, deltaTime);
    });

    scene.update

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
}
renderer.setAnimationLoop( animate );