import * as THREE from 'three/webgpu';
import planet from './planet';
import { AU } from './constants';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGPURenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const sun = new THREE.Mesh( new THREE.SphereGeometry( 696340 / AU, 32), new THREE.MeshBasicMaterial( { color: 0xffffdd } ));
scene.add( sun );
scene.background = new THREE.Color(0x000000);

// const debug = new THREE.Mesh( new THREE.SphereGeometry( 0.1/*696340 / AU*/, 32), new THREE.MeshBasicMaterial( { color: 0x00ff44 } ));
// scene.add( debug );

camera.position.z = 1.2;
camera.position.y = 0.2;
camera.lookAt(sun.position);

let planets = [];

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

    sun.rotation.x += 0.01;
    sun.rotation.y += 0.01;
    planets.forEach((p) => {
        p.computeCoordinates(accTime);// time * timeScale);
        p.update();
    });
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );

console.log(scene);