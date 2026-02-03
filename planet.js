import { MathUtils, ObjectSpaceNormalMap, SRGBColorSpace } from "three";
import { BufferAttribute, BufferGeometry, DoubleSide, Line, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial, MeshBasicNodeMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, Object3D, Plane, PlaneGeometry, Quaternion, Sphere, SphereGeometry, TextureLoader, Vector3 } from "three/webgpu";
import { AU } from "./constants";
import { vec4, positionWorld, positionWorldDirection, float, Fn, shininess, uv, sub, mul, length, vec2, texture, If, lessThan, Discard, uniform, assign, max, div, lessThanEqual, or, lengthSq, normalize, bufferAttribute } from "three/tsl";

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
    constructor(name, radius, color, scene, tilt, dayDuration, textureLoader, textureSrc, normalSrc, ringSrc, ringRelativeSize, ringStart)
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
        this.scene = scene;

        this.geometry = new SphereGeometry(1, 64);

        
        if (name == "earth") {
            this.material = new MeshStandardMaterial(
            { color: color,
                emissive: 0xffffff,
                emissiveIntensity: 0.1,
                roughnessMap: textureLoader.load('data/planets/earthwatermap.jpg'),
                roughness: 0.7,
                emissiveMap: textureLoader.load('data/planets/earth_nighttime.jpg'),
            });
            let cloudTexture = textureLoader.load('data/planets/earth_cloud.png');
            this.clouds = new Mesh(this.geometry,
                new MeshLambertMaterial({map: cloudTexture, alphaMap: cloudTexture, transparent: true, opacity: 0.5}));
        }
        else this.material = new MeshStandardMaterial( { color: color, emissive: color, emissiveIntensity: 0.03, shininess: 15} );

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

        if (this.clouds !== undefined) {
            this.mesh.add(this.clouds);
            let cloudsScale = 1.01;
            this.clouds.scale.multiplyScalar(cloudsScale);
        }
        if (ringSrc !== undefined) {
            this.uniforms = {
                ringStart: uniform(ringStart),
                planetCenter: uniform(new Vector3().copy(this.mesh.position)),
                planetOrbitSq: uniform(size*size),
                planetOrbit: uniform(size),
                planetRadiusSq: uniform(size*size),
            }
            this.ringMaterial = new MeshBasicNodeMaterial({map: textureLoader.load(ringSrc), transparent: true, side: DoubleSide});
            const main = Fn(() => {
                const c = uv().sub(vec2(0.5,0.5)).mul(2);
                const cl = length(c);
                const ringSpace = float(1).sub(this.uniforms.ringStart);
                const r = max(0, cl.sub(this.uniforms.ringStart).div(ringSpace));
                If(r.lessThanEqual(0).or(float(1).lessThanEqual(r)), () => {
                    Discard();
                });
                const col = texture(this.ringMaterial.map, vec2(float(1).sub(r), 0.5)).toVar();
                If(col.a.lessThan(0.2), () => {
                    Discard();
                });
                // Shadow
                const p = positionWorld;
                If(this.uniforms.planetOrbitSq.lessThan(lengthSq(p)), () => {
                    //col.r.assign(1);
                    const projectedPosition = normalize(positionWorld).mul(this.uniforms.planetOrbit);
                    const projectedRadiusSq = lengthSq(projectedPosition.sub(this.uniforms.planetCenter));
                    
                    If(projectedRadiusSq.lessThan(this.uniforms.planetRadiusSq),
                    () => {
                        col.rgb.assign(col.mul(0.02).rgb);
                    })
                });
                return col;
            });
            this.ringMaterial.fragmentNode = main();
            this.ring = new Mesh(new PlaneGeometry(2, 2, 1, 1), this.ringMaterial);
            this.ring.scale.set(ringRelativeSize, ringRelativeSize, ringRelativeSize);
            this.mesh.add(this.ring);
            this.ring.quaternion.setFromAxisAngle(new Vector3(1,0,0), Math.PI * 0.5);
        }

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
        this._o = o;    
        
        // Orbit
        let orbitCount = 360 + 1;
        this.orbitPoints = new Float32Array(orbitCount*3);

        let orbitPeriod = (orbitCount-1) * 36525/L; // In dayso
        let daysOrbitSample = orbitPeriod / (orbitCount-1);
        
        for (let i = 0; i < orbitCount; ++i)
        {
            this.computeCoordinates(daysOrbitSample * i, false);
            this.orbitPoints[i*3] = this.computedPosition.x;
            this.orbitPoints[i*3 + 1] = this.computedPosition.y;
            this.orbitPoints[i*3 + 2] = this.computedPosition.z;
        }

        this.orbitMaterial = new LineBasicMaterial({color: this.color, opacity: 1, transparent: true});
        this.orbit = new Line(new BufferGeometry().setAttribute('position', new BufferAttribute(this.orbitPoints, 3)), this.orbitMaterial);
        this.scene.add(this.orbit);
        this.orbit.visible = false;// degrees/century
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

    computeCoordinates(time, applyCoordinates = true)
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

        if (applyCoordinates) {
            this.mesh.quaternion.setFromAxisAngle(this.rotationAxis, time * 2 * Math.PI / this.dayDuration);
            this.mesh.quaternion.premultiply(this.tiltQuaternion);
            if (this.clouds !== undefined) {
                this.clouds.rotateY(0.000005*time);
            }
        }
    }

    update(uxDistanceFromSun, uxFactor, ringsConfig, size)
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
        if (this.orbit.visible) this.orbitMaterial.opacity = 1 - uxFactor;

        this.realObject.position.copy(this.computedPosition);
        this.mesh.scale.set(size,size,size);

        if (this.name == "saturn")
        {
            this.uniforms.ringStart.value = ringsConfig.saturnRingStart;
            this.ring.scale.set(ringsConfig.saturnRingSize, ringsConfig.saturnRingSize, ringsConfig.saturnRingSize);
        }
        else if (this.name == "uranus")
        {
            this.uniforms.ringStart.value = ringsConfig.uranusRingStart;
            this.ring.scale.set(ringsConfig.uranusRingSize, ringsConfig.uranusRingSize, ringsConfig.uranusRingSize);
        }
        if (this.uniforms !== undefined) {
            this.uniforms.planetRadiusSq.value = size*size;
            this.uniforms.planetCenter.value.copy(this.mesh.position);
            let orbitRadius = this.mesh.position.length();
            this.uniforms.planetOrbit.value = orbitRadius;
            this.uniforms.planetOrbitSq.value = orbitRadius * orbitRadius;
        }
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