import * as THREE from 'three/webgpu';
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

// Solar System Strings S^3

let config = {
    daysPerSecond: 29,
    unifiedScaleFactor: 0.15,
    realisticScaleFactor: 0.94,
    unifiedScale: 8,
    realisticScale: 55,
    camera: {
        y: 6,
        fov: 75, 
    },
    sun: {
        intensity:12,
    },
    bg: {
        color: "#000000",
    },
    ux: {
        planetSize: 0.05,
        sunSize: 0.1,
        usabilityFactor: 0,
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
    }
}

let audioReady = false;
document.addEventListener("click", async () => {
    if (!audioReady) {
        await Tone.start();
        audioReady = true;
    }
});


const gui = new dat.GUI({name: 'settings'});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( config.camera.fov, window.innerWidth / window.innerHeight, 0.001, 1000 );

gui.add(config, "daysPerSecond", 1, 365);
let cameraGUI = gui.addFolder("Camera");
cameraGUI.add(config.camera, "y", 0, 100);
cameraGUI.add(config.camera, "fov", 5, 110);
let sunGUI = gui.addFolder("Sun");
sunGUI.add(config.sun, "intensity", 0, 20);
let scaleGUI = gui.addFolder("Scale")
scaleGUI.add(config, "realisticScaleFactor", 0, 1);
scaleGUI.add(config, "unifiedScaleFactor", 0, 1);
scaleGUI.add(config, "unifiedScale", 1, 65);
scaleGUI.add(config, "realisticScale", 1, 65);
let uxGUI = gui.addFolder("UX");
uxGUI.add(config.ux, "planetSize", 0.01, 0.2);
uxGUI.add(config.ux, "sunSize", 0.01, 0.2);
uxGUI.add(config.ux, "usabilityFactor", 0, 1);
uxGUI.open();
let synthGUI = gui.addFolder("Synth");
synthGUI.add(config.synth, "attack", 0, 2);
synthGUI.add(config.synth, "decay", 0, 2);
synthGUI.add(config.synth, "sustain", 0, 1);
synthGUI.add(config.synth, "release", 0, 2);
synthGUI.add(config.synth, "volume", 0, 1);
let pluckGUI = gui.addFolder("Pluck");
pluckGUI.add(config.pluck, "attackNoise", 0.1, 1.5, 0.05);
pluckGUI.add(config.pluck, "dampening", 0, 7000);
pluckGUI.add(config.pluck, "resonance", 0, 1);
pluckGUI.add(config.pluck, "release", 0.01, 10);
pluckGUI.open();

const renderer = new THREE.WebGPURenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd } ));
const sunRadius = 696340;
const sunLight = new THREE.PointLight(0xfffffe, config.sun.intensity, 0, 0);
sun.add(sunLight);
scene.add( sun );
scene.background = new THREE.Color(config.bg.color);
var bgColor = gui.addColor(config.bg, "color");
bgColor.onChange((v) => {
    scene.background.set(v);
})


camera.position.z = 0;
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

for (let i = 1; i < planets.length; ++i)
{
    let cares = [];
    for (let j = i-1; j >= 0; --j) cares.push(planets[j].mesh);
    let string = new stellarString(config, scene, sun, planets[i].mesh, planets[i].color, cares);
    strings.push(string);
}
//

function animate() {
    let currentTimeMS = Date.now();
    let deltaTime = currentTimeMS - timeMS;
    timeMS = currentTimeMS;
    accTimeMS += deltaTime;
    accTimeDays += deltaTime/1000 * config.daysPerSecond;

    camera.position.y = config.camera.y;
    camera.fov = config.camera.fov;
    camera.updateProjectionMatrix();

    sunLight.intensity = config.sun.intensity;

    let sunSize = lerp(sunRadius / AU, config.unifiedScale, config.unifiedScaleFactor);
    let directSunScaledSize = config.realisticScale * sunRadius / AU;
    sunSize = lerp(sunSize, directSunScaledSize, config.realisticScaleFactor);
    sun.scale.set(sunSize,sunSize,sunSize);

    planets.forEach((p) => {
        p.computeCoordinates(accTimeDays);
        p.update();
        let size = lerp(p.radius / AU, config.unifiedScale, config.unifiedScaleFactor);
        let directScaledSize = config.realisticScale * p.radius / AU;
        size = lerp(size, directScaledSize, config.realisticScaleFactor);
        p.mesh.scale.set(size,size,size);
    });

    strings.forEach((s) => {
        s.update(audioReady, accTimeMS, deltaTime);
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
}
renderer.setAnimationLoop( animate );