import * as THREE from 'three/webgpu';
import * as Tone from 'tone';
import { AU, c } from './constants';

export default class stellarString
{
    /**
     * Velocity = sqrt(Tension/LinearDensity)
     * 
     * linearDensity of a stellar string = 1 kg/m ?
     * Tension of a stellar string for v = c
     * T = V^2 * LD => c^2 => 8.987551787368176e+16 m*kg/s2=>N
     * 
     * Assume string is tense to allow wave to travel at the speed of light c
     * 
     * Frequency = Velocity / 2Length
     */

    constructor(config, scene, fromObject, toObject, color, planetsToCare)
    {
        this.pluck = new Tone.PluckSynth(config.pluck).toDestination();

        this.from = fromObject;
        this.config = config;
        this.to = toObject;
        this.planetsToCare = planetsToCare;
        this.lastPluckedTime = Tone.now();

        this.points = [];
        this.points.push(fromObject.position.clone(), toObject.position.clone());
        this.material = new THREE.LineBasicMaterial({color: color});
        this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);
        this.line = new THREE.Line(this.geometry, this.material);
        scene.add(this.line);

        this.planetsCrossProducts = [];
        this.deltaString = this.to.position.clone().sub(this.from.position);
        this.deltaPlanet = new THREE.Vector3();
        this.crossResult = new THREE.Vector3();
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

    update(audioReady, time, deltaTime) {
        this.points[0].copy(this.from.position);
        this.points[1].copy(this.to.position);
        this.geometry.setFromPoints(this.points);
        let pluckedThisFrame = false;

        this.deltaString.copy(this.to.position).sub(this.from.position);
        let stringLength = this.deltaString.length();
        for (let i = 0; i < this.planetsToCare.length; ++i)
        {
            if (this.planetsToCare[i] == this.from && this.planetsToCare[i] == this.to) continue;

            this.deltaPlanet.copy(this.planetsToCare[i].position).sub(this.from.position);
            this.crossResult.crossVectors(this.deltaString, this.deltaPlanet);
            let cross = this.crossResult.y;
            let lastCross = this.planetsCrossProducts[i];
            let aux = this.deltaString.dot(this.deltaPlanet);

            if (lastCross > 0 && cross <= 0 && aux > 0 && aux < stringLength && audioReady && !pluckedThisFrame) {
                pluckedThisFrame = true;
                this.pluckedBy(this.planetsToCare[i]);
            }

            this.planetsCrossProducts[i] = cross;
        }
    }

    pluckedBy(planet) {
        let stringLength = this.from.position.distanceTo(this.to.position);
        let frequency = c / AU / stringLength;
        let simulationFrequency = frequency * 86400 * this.config.daysPerSecond;

        let now = Tone.now();
        if (now > this.lastPluckedTime && simulationFrequency < 20000 && simulationFrequency > 15) {
            //console.log("plucked by", planet.name, simulationFrequency)
            this.pluck.triggerAttackRelease(simulationFrequency);
            this.lastPluckedTime = now;
        }
    }
}