import * as THREE from 'three/webgpu';
import planet from './planet';
import { AU } from './constants';
import { lerp } from 'three/src/math/MathUtils';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGPURenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const sun = new THREE.Mesh( new THREE.SphereGeometry( 1, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd } ));
scene.add( sun );
scene.background = new THREE.Color(0x000000);

// const debug = new THREE.Mesh( new THREE.SphereGeometry( 0.1/*696340 / AU*/, 32), new THREE.MeshBasicMaterial( { color: 0x00ff44 } ));
// scene.add( debug );

camera.position.z = 1.2;
camera.position.y = 0.2;
camera.lookAt(sun.position);

let planets = [];

let mercury = new planet("mercury", 2439.4, 0x660000, scene);
mercury.setKeplerianElements(0.38709843, 0, 0.20563661, 0.00002123, 7.00559432, -0.00590158, 252.2516672, 149472.6749, 77.45771895, 0.15940013, 48.33961819, -0.12214182);
planets.push(mercury);

let venus = new planet("venus", 6051.8, 0x777700, scene);
venus.setKeplerianElements(0.72332102, -0.00000026, 0.00676399, -0.00005107, 3.39777545, 0.00043494, 181.9797085, 58517.8156, 131.7675571, 0.05679648, 76.67261496, -0.27274174);
planets.push(venus);

let earth = new planet("earth", 6371.0084, 0x0044ff, scene);
earth.setKeplerianElements(1.00000018, -0.00000003, 0.01673163, -0.00003661, -0.00054346, -0.01337178, 100.4669157, 35999.37306, 102.9300589, 0.3179526, -5.11260389, -0.24123856);
planets.push(earth);

let time = Date.now();
let timeScale = 1/100;
let accTime = 2451545;

function animate() {
    let newTime = Date.now();
    let deltaTime = newTime - time;
    time = newTime;
    accTime += deltaTime * timeScale;

    let unifiedScale = 0.02;

    let scaleFactor = (Math.sin(time / 360 / 3) + 1)/2;
    let sunSize = lerp(696340 / AU, unifiedScale, scaleFactor);
    sun.scale.set(sunSize,sunSize,sunSize);
    planets.forEach((p) => {
        p.computeCoordinates(accTime);// time * timeScale);
        p.update();
        let size = lerp(p.radius / AU, unifiedScale, scaleFactor);
        p.mesh.scale.set(size,size,size);
    });
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );

console.log(scene);