import * as THREE from 'three/webgpu';
import * as Tone from 'tone';
import { AU, c } from './constants';
import {assign, Fn, greaterThan, If, mul, PI, sin, time, uv, vec4, float,add, abs, Discard, uniform, div, cos, any, mix, lessThan, and, min} from 'three/tsl';
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
        stringUp.multiplyScalar(config.strings.stringWidth);
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
        this.material = new THREE.MeshBasicNodeMaterial({color: color});
        this.geometry = new THREE.BufferGeometry().setAttribute('position', this.positionAttribute);
        this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.pluckingTime = 0;
        scene.add(this.mesh);

        this.uniforms = {
            frequency: uniform(440),
            width: uniform(0.1),
            intensity: uniform('float'),
            fromColor: uniform(new THREE.Color(this.from.color)),
            toColor: uniform(new THREE.Color(this.to.color)),
            pluckedByColor: uniform(new THREE.Color(this.to.color)),
            pluckedByRadius: uniform(0.05),
            pluckedByUv: uniform(0.5),
            coloredEdge: uniform(0.1),
            coloredEdgeStart: uniform(0.1),
            stringColor: uniform(new THREE.Color(config.strings.stringColor)),
        };

        const overtone = Fn(([xPi, tF, o]) => {
            return sin(xPi.mul(o)).mul(sin(tF.mul(o))).div(o);
        })

        const main = Fn(() => {
            const f = this.uniforms.frequency;
            const v = uv();
            const xPi = v.x.mul(PI);
            const tf = time.mul(f);
            const xS = float(0).toVar();
            const result = vec4(this.uniforms.stringColor.rgb, float(1)).toVar();
            const w = this.uniforms.width.toVar();
            const i = float(1).sub(this.uniforms.intensity).toVar();
            i.assign(i.mul(i));
            i.assign(float(1).sub(i));

            If(this.uniforms.intensity.greaterThan(0), () => {
                xS.assign(sin(xPi).mul(sin(tf)).add(overtone(xPi, tf, 2)).add(overtone(xPi, tf, 3)).add(overtone(xPi, tf, 4)).add(overtone(xPi, tf, 5)));
                xS.assign(xS.mul(this.uniforms.intensity));
                result.assign(mix(result, vec4(1,1,1,1), i));//.add(this.uniforms.pluckedByColor.mul(this.uniforms.intensity)));
                w.assign(w.add(w.mul(i)));
            });
            
            const edge = this.uniforms.coloredEdge.add(this.uniforms.coloredEdgeStart);
            If(v.x.lessThan(this.uniforms.coloredEdgeStart), () => {
                result.assign(this.uniforms.toColor);
            }).ElseIf(v.x.lessThan(edge), () => {
                result.assign(mix(this.uniforms.toColor, result, v.x.sub(this.uniforms.coloredEdgeStart).div(this.uniforms.coloredEdge)));
            }).ElseIf(v.x.greaterThan(float(1).sub(edge)), ()=> {
                result.assign(mix(this.uniforms.fromColor, result, float(1).sub(this.uniforms.coloredEdgeStart).sub(v.x).div(this.uniforms.coloredEdge)));
            }).ElseIf(v.x.greaterThan(float(1).sub(this.uniforms.coloredEdgeStart)), () => {
                result.assign(this.uniforms.fromColor);
            })
            const y = v.y.sub(0.5).mul(w.add(2+1));

            
            If (this.uniforms.intensity.greaterThan(0).and(abs(v.x.sub(this.uniforms.pluckedByUv)).lessThan(this.uniforms.pluckedByRadius)), () => {
                const pl = min(float(1), this.uniforms.intensity.div(float(0.3)));
                result.assign(mix(result, this.uniforms.pluckedByColor, pl));
            });
            
            const distance = abs(y.sub(xS));
            If(distance.greaterThan(w), () => {
                Discard();
            });
            return result;
        });

        this.material.fragmentNode = main();

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
        this.uniforms.width.value = this.config.strings.fragmentWidth;
        this.uniforms.stringColor.value.set(this.config.strings.stringColor);
        //console.log(this.config.strings.stringColor);

        if (this.pluckingTime > 0)
        {
            this.pluckingTime -= deltaTime/1000;
            if (this.pluckingTime <= 0) this.pluckingTime = 0;
            this.uniforms.intensity.value = this.pluckingTime/this.pluckingFadeoutTime;
        }
        let stringUp = this.stringUp;
        let v = this.deltaString;
        let cameraFwd = this.deltaPlanet;
        cameraFwd.set(0,0,-1).applyQuaternion(camera.quaternion);

        this.deltaString.copy(this.to.position).sub(this.from.position).normalize();
        stringUp.crossVectors(this.deltaString, cameraFwd).normalize().multiplyScalar(this.config.strings.stringWidth);

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
                this.pluckedBy(this.planetsToCare[i], dot/stringLength);
            }

            this.planetsCrossProducts[i] = cross;
        }
        this.uniforms.coloredEdge.value = this.config.strings.coloredEdge/stringLength;
        this.uniforms.coloredEdgeStart.value = this.config.strings.coloredEdgeStart/stringLength;
        this.uniforms.pluckedByRadius.value = 0.1/stringLength;
    }

    pluckedBy(planet, percentagePluck) {
        let stringLength = this.from.position.distanceTo(this.to.position);
        let frequency = this.config.soundVelocity * c / AU / stringLength;
        let simulationFrequency = frequency * 86400 * this.config.daysPerSecond;

        let now = Tone.now();
        if (now > this.lastPluckedTime) {
            //console.log("plucked by", planet.name, simulationFrequency)
            if (simulationFrequency < 24000 && simulationFrequency > 16)
                this.pluck.triggerAttack(simulationFrequency);
            else {
                console.log(planet.name, "plucked string ["+this.from.name+" - "+this.to.name+"], resulting in a vibration frequency of", simulationFrequency);
            }
            this.lastPluckedTime = now;
            let l = Math.pow(simulationFrequency / this.config.strings.fadeOutTimeFrequency, 0.33333333);
            this.pluckingTime = this.config.strings.fadeOutTime / l;
            this.pluckingFadeoutTime = this.pluckingTime;
            this.uniforms.frequency.value = simulationFrequency;
            this.uniforms.pluckedByColor.value.setHex(planet.color)
            this.uniforms.pluckedByUv.value = percentagePluck;
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}