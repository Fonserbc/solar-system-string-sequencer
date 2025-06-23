import * as THREE from 'three/webgpu';
import planet from './planet';
import { AU } from './constants';
import { lerp } from 'three/src/math/MathUtils';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.001, 1000 );

const renderer = new THREE.WebGPURenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd } ));
const sunRadius = 696340;
scene.add( sun );
scene.background = new THREE.Color(0x000000);

// const debug = new THREE.Mesh( new THREE.SphereGeometry( 0.1/*696340 / AU*/, 32), new THREE.MeshBasicMaterial( { color: 0x00ff44 } ));
// scene.add( debug );

camera.position.z = 6;
camera.position.y = 1;
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


let timeMS = Date.now();
let timeScale = 365/10; // 1 year every 10 seconds
let accTimeDays = 0;

function animate() {
    let currentTimeMS = Date.now();
    let deltaTime = currentTimeMS - timeMS;
    timeMS = currentTimeMS;
    accTimeDays += deltaTime/1000 * timeScale;

    let unifiedScale = 50;
    let realisticScale = 50;
    let unifiedScaleFactor = 0.01;//(Math.sin(time / 360 / 3) + 1)/2;
    let realisticScaleFactor = 0.9;

    let sunSize = lerp(sunRadius / AU, unifiedScale, unifiedScaleFactor);
    let directSunScaledSize = realisticScale * sunRadius / AU;
    sunSize = lerp(sunSize, directSunScaledSize, realisticScaleFactor);
    sun.scale.set(sunSize,sunSize,sunSize);

    planets.forEach((p) => {
        p.computeCoordinates(accTimeDays);
        p.update();
        let size = lerp(p.radius / AU, unifiedScale, unifiedScaleFactor);
        let directScaledSize = realisticScale * p.radius / AU;
        size = lerp(size, directScaledSize, realisticScaleFactor);
        p.mesh.scale.set(size,size,size);
    });
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );

console.log(scene);