import { MathUtils, ObjectSpaceNormalMap, SRGBColorSpace } from "three";
import { Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, Object3D, Quaternion, Sphere, SphereGeometry, TextureLoader, Vector3 } from "three/webgpu";
import { AU } from "./constants";
import { shininess } from "three/tsl";

function sin (d) {
    return Math.sin(d * MathUtils.DEG2RAD);
}
function cos (d) {
    return Math.cos(d * MathUtils.DEG2RAD);
}

function sinh(a) {
	return (Math.exp(a) - Math.exp(-a)) / 2;
}

function cosh(a) {
	return ((Math.E ** a) + (Math.E ** -a)) / 2;
}
const CIRCLE = 2 * Math.PI;

export default class planet
{
    constructor(name, radius, color, scene, tilt, dayDuration, textureLoader, textureSrc, normalSrc)
    {
        this.name = name;
        this.radius = radius;
        this.color = color;
        this.computedPosition = new Vector3();
        this.meshPosition = new Vector3();
        this.tilt = tilt/ 180 * Math.PI;// + Math.PI;
        this.dayDuration = dayDuration; // in earth days
        this.tiltQuaternion = new Quaternion();
        this.rotationAxis = new Vector3(0,1,0);
        this.tiltQuaternion.setFromAxisAngle(new Vector3(1,0,0), this.tilt);

        this.geometry = new SphereGeometry(1, 32);

        this.material = new MeshPhongMaterial( { color: color, emissive: color, emissiveIntensity: 0.03, shininess: 15} );
        if (textureSrc !== undefined) {
            this.texture = textureLoader.load(textureSrc);
            this.texture.colorSpace = SRGBColorSpace;
            this.material.map = this.texture;
            this.material.color.setHex(0xffffff);
        }
        if (normalSrc !== undefined) {
            this.normalMap = textureLoader.load(normalSrc);
            this.material.normalMap = this.normalMap;
            this.material.normalScale.y = -1;
        }
        this.mesh = new Mesh( this.geometry, this.material );
        this.mesh.name = name;
        this.realObject = new Object3D();
        this.realObject.color = color;
        this.realObject.name = name;

        let size = radius / AU;
        this.mesh.scale.set(size,size,size);

        this.realDistanceFromSun = 1;
        this.visualDistanceFromSun = 1;
        //console.log(this);
        scene.add(this.mesh);
    }

    // Expected keplerian elements from: https://ssd.jpl.nasa.gov/planets/approx_pos.html
    setKeplerianElements(a0, a, e0, e, I0, I, L0, L, lp0, lp, o0, o)
    {
        this.semiMajorAxis = a0;            // AU
        this._a = a;                        // AU/century
        this.eccentricity = e0;
        this._e = e;                        // change per century
        this.inclination = I0;              // degrees
        this._I = I;                        // degrees/century
        this.meanLongitude = L0;            // degrees
        this._L = L;                        // degrees/century
        this.longitudeOfPerihelion = lp0;   // degrees
        this._lp = lp;                      // degrees/century
        this.longitudeOfAscendingNode = o0; // degrees
        this._o = o;                        // degrees/century
    }

    setAdditionalTerms(b, c, s, f) {
        this.b = b;
        this.c = c;
        this.s = s;
        this.f = f;
    }

    hasAdditionalTerms() {
        return this.b !== undefined;
    }

    computeCoordinates(time)
    {
        // Keplerian elements taken from NASA's https://ssd.jpl.nasa.gov/planets/approx_pos.html
        // time is expected in days since J2000.00
        let T = time/36525;

        // 1: compute current values of the 6 elements
        // for our 2d simplification, I will only care about the changing mean longitude
        // Every other element will remain constant through time for our simplification
        let a = this.semiMajorAxis;// + this._a * T;
        let e = this.eccentricity;// + this._e * T;
        let I = this.inclination;// + this._I * T;
        let L = this.meanLongitude + this._L * T;
        let lp = this.longitudeOfPerihelion;// + this._lp * T;
        let o = this.longitudeOfAscendingNode;// + this._o * T;

        // 2: compute perihelion w, and mean anomaly M
        let w = lp - o; // constant in our simplification
        let M = L - lp;
        if (this.hasAdditionalTerms()) {
            M += this.b * T * T + this.c * cos(this.f * T) + this.s * sin(this.f * T);
        }
        I *= MathUtils.DEG2RAD;
        M *= MathUtils.DEG2RAD;
        w *= MathUtils.DEG2RAD;
        o *= MathUtils.DEG2RAD;

        //console.log('M %s, e %s, i %s, o %s, w %s', M, e, I, o, w);

        let E = solveEccentricAnomaly(e, M);
        
        E %= CIRCLE;
		I %= CIRCLE;
		o %= CIRCLE;
		w %= CIRCLE;
		M %= CIRCLE;
        e %= CIRCLE;

        //console.log(e, 1 - e*e);

        this.computedPosition.set(a * (Math.cos(E) - e), 0, a * (Math.sqrt(1 - (e * e))) * Math.sin(E));

        this.mesh.quaternion.setFromAxisAngle(this.rotationAxis, time * 2 * Math.PI / this.dayDuration);
        this.mesh.quaternion.premultiply(this.tiltQuaternion);
    }

    update(uxDistanceFromSun, uxFactor)
    {
        if (uxFactor > 0) {
            //let distanceFromSun = this.computedPosition.length();
            this.realDistanceFromSun = this.computedPosition.length();
            this.visualDistanceFromSun = MathUtils.lerp(this.realDistanceFromSun, uxDistanceFromSun, uxFactor);

            this.meshPosition.copy(this.computedPosition).normalize().multiplyScalar(uxDistanceFromSun);
            this.mesh.position.lerpVectors(this.computedPosition, this.meshPosition, uxFactor);
        }
        else {
            this.mesh.position.copy(this.computedPosition);
        }
        this.realObject.position.copy(this.computedPosition);

        //

    }
}

function solveEccentricAnomaly(e, M) {
    if (e === 0.0) {
        return M;
    } else if (e < 0.9) {
        return solveEccentricAnomalyMax(solveKepler(e, M), M, 6);
    } else if (e < 1.0) {
        const E = M + 0.85 * e * ((Math.sin(M) >= 0.0) ? 1 : -1);
        return solveEccentricAnomalyMax(solveKeplerLaguerreConway(e, M), E, 8);
    } else if (e === 1.0) {
        return M;
    }
    
    const E = Math.log(2 * M / e + 1.85);
    return solveEccentricAnomalyMax(solveKeplerLaguerreConwayHyp(e, M), E, 30);
}

function solveEccentricAnomalyMax(f, x0, maxIter) {
	let x = 0;
	let x2 = x0;
	
	for (let i = 0; i < maxIter; i++) {
		x = x2;
		x2 = f(x);
	}
	
	return x2;
}

function solveKepler(e, M) {
	return (x) => {
		return x + (M + e * Math.sin(x) - x) / (1 - e * Math.cos(x));
	};
}

function solveKeplerLaguerreConway(e, M) {
	return (x) => {
		const s = e * Math.sin(x);
		const c = e * Math.cos(x);
		const f = x - s - M;
		const f1 = 1 - c;
		const f2 = s;

		return x + (-5 * f / (f1 + MathUtils.sign(f1) * Math.sqrt(Math.abs(16 * f1 * f1 - 20 * f * f2))));
	};
}

function solveKeplerLaguerreConwayHyp(e, M) {
	return (x) => {
		const s = e * sinh(x);
		const c = e * cosh(x);
		const f = x - s - M;
		const f1 = c - 1;
		const f2 = s;

		return x + (-5 * f / (f1 + MathUtils.sign(f1) * Math.sqrt(Math.abs(16 * f1 * f1 - 20 * f * f2))));
	};
}