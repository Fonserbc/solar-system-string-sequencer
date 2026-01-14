import * as THREE from 'three/webgpu';
import * as Tone from 'tone';
import { AU, c } from './constants';
import { normalize } from 'three/src/math/MathUtils';

export default class stellarString
{
    /**
     * Velocity = sqrt(Tension/LinearDensity)
     * 
     * linearDensity of a stellar string = 1 kg/m ?
     * Tension of a stellar string for v = c
     * T = V^2 * LD => c^2 => 8.987551787368176e+16 m*kg/s2=>N
     * 
     * Assume string is tense enough to allow wave to travel at the speed of light c
     * 
     * Frequency = Velocity / 2Length
     */

    constructor(config, scene, fromObject, toObject, color, planetsToCare, fromObjectVisual, toObjectVisual)
    {
        this.pluck = new Tone.PluckSynth(config.pluck).toDestination();
        this.scene = scene;
        this.from = fromObject;
        this.to = toObject;
        this.config = config;
        this.fromVisual = fromObjectVisual === undefined? this.from : fromObjectVisual;
        this.toVisual = toObjectVisual === undefined? this.to : toObjectVisual;
        this.planetsToCare = planetsToCare;
        this.lastPluckedTime = Tone.now();
        //console.log(this.from, this.to, planetsToCare);

        let pointCount = this.pointCount = 128;
        this.points = new Float32Array(pointCount*3);
        this.vertices = new Float32Array(pointCount*2*3);
        this.indices = new Int32Array((pointCount-1)*2*3);
        this.uv = new Float32Array(pointCount*2*2);
        let v = new THREE.Vector3();
        let stringUp = this.stringUp = this.to.position.clone().sub(this.from.position).normalize();
        let aux = stringUp.z;
        stringUp.z = -stringUp.x;
        stringUp.x = aux;
        stringUp.multiplyScalar(config.strings.width);
        for (let i = 0; i < pointCount; i++) {
            let f = i/(pointCount-1);
            v.lerpVectors(this.fromVisual.position, this.toVisual.position, f);
            this.points[i*3] = v.x;
            this.points[i*3+1] = v.y;
            this.points[i*3+2] = v.z;
            this.vertices[i*6+0] = v.x + stringUp.x;
            this.vertices[i*6+1] = v.y + stringUp.y;
            this.vertices[i*6+2] = v.z + stringUp.z;
            this.vertices[i*6+3] = v.x - stringUp.x;
            this.vertices[i*6+4] = v.y - stringUp.y;
            this.vertices[i*6+5] = v.z - stringUp.z;
            this.uv[i*4] = f;
            this.uv[i*4+1] = 0;
            this.uv[i*4+2] = f;
            this.uv[i*4+3] = 1;
            if (i < pointCount - 1)
            {
                this.indices[i*6+0] = i*2+0;
                this.indices[i*6+1] = i*2+1;
                this.indices[i*6+2] = i*2+2;
                this.indices[i*6+3] = i*2+2;
                this.indices[i*6+4] = i*2+1;
                this.indices[i*6+5] = i*2+3;
            }
        }
        this.positionAttribute = new THREE.BufferAttribute(this.vertices, 3);
        this.material = new THREE.MeshBasicMaterial({color: color});
        this.geometry = new THREE.BufferGeometry().setAttribute('position', this.positionAttribute);
        this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        this.planetsCrossProducts = [];
        this.deltaString = this.to.position.clone().sub(this.from.position);
        this.deltaPlanet = new THREE.Vector3();
        this.crossResult = new THREE.Vector3();
        this.projectionResult = new THREE.Vector3();
        for (let i = 0; i < planetsToCare.length; ++i)
        {
            if (this.planetsToCare[i] == this.from && this.planetsToCare[i] == this.to) {
                this.planetsCrossProducts.push(0);
                continue;
            }

            this.deltaPlanet.copy(planetsToCare[i].position).sub(this.from.position);
            this.crossResult.crossVectors(this.deltaString, this.deltaPlanet);
            this.planetsCrossProducts.push(this.crossResult.y);
        }
    }

    update(audioReady, time, deltaTime, transformationFuction, camera)
    {
        let stringUp = this.stringUp;
        let v = this.deltaString;
        let cameraFwd = this.deltaPlanet;
        cameraFwd.set(0,0,-1).applyQuaternion(camera.quaternion);

        this.deltaString.copy(this.to.position).sub(this.from.position).normalize();
        stringUp.crossVectors(this.deltaString, cameraFwd).normalize().multiplyScalar(this.config.strings.width);

        for (let i = 0; i < this.positionAttribute.count; i+=2) {
            v.lerpVectors(this.from.position, this.to.position, (i/2)/(this.pointCount-1));
            transformationFuction(v);

            this.positionAttribute.setXYZ(i, v.x + stringUp.x, v.y + stringUp.y, v.z + stringUp.z);
            this.positionAttribute.setXYZ(i+1, v.x - stringUp.x, v.y - stringUp.y, v.z - stringUp.z);
        }
        this.positionAttribute.needsUpdate = true;
        let pluckedThisFrame = false;

        this.deltaString.copy(this.to.position).sub(this.from.position);
        let stringLength = this.deltaString.length();
        for (let i = 0; i < this.planetsToCare.length; ++i)
        {
            if (this.planetsToCare[i] == this.from || this.planetsToCare[i] == this.to) continue;
            if (!this.planetsToCare[i].plucking) continue;

            this.deltaPlanet.copy(this.planetsToCare[i].position).sub(this.from.position);
            this.crossResult.crossVectors(this.deltaString, this.deltaPlanet);
            let cross = this.crossResult.y;
            let lastCross = this.planetsCrossProducts[i];
            this.projectionResult.copy(this.deltaPlanet).projectOnVector(this.deltaString);
            let dot = this.deltaString.normalize().dot(this.projectionResult);

            if (Math.sign(cross) != Math.sign(lastCross) && dot > 0 && dot < stringLength && audioReady && !pluckedThisFrame) {
                pluckedThisFrame = true;
                this.pluckedBy(this.planetsToCare[i]);
            }

            this.planetsCrossProducts[i] = cross;
        }
    }

    pluckedBy(planet) {
        let stringLength = this.from.position.distanceTo(this.to.position);
        let frequency = this.config.soundVelocity * c / AU / stringLength;
        let simulationFrequency = frequency * 86400 * this.config.daysPerSecond;

        let now = Tone.now();
        if (now > this.lastPluckedTime && simulationFrequency < 20000 && simulationFrequency > 15) {
            //console.log("plucked by", planet.name, simulationFrequency)
            this.pluck.triggerAttackRelease(simulationFrequency);
            this.lastPluckedTime = now;
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}