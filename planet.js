import { MathUtils } from "three";
import { Mesh, MeshBasicMaterial, Sphere, SphereGeometry, Vector3 } from "three/webgpu";
import { AU } from "./constants";

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
    constructor(name, radius, color, scene)
    {
        this.name = name;
        this.radius = radius;
        this.color = color;
        this.computedPosition = new Vector3();

        this.geometry = new SphereGeometry(radius / AU, 32);

        this.material = new MeshBasicMaterial( { color: color } );
        this.mesh = new Mesh( this.geometry, this.material );
        console.log(this);
        scene.add(this.mesh);
    }

    setKeplerianElements(a0, a, e0, e, I0, I, L0, L, lp0, lp, o0, o)
    {
        this.a0 = a0;
        this._a = a;
        this.e0 = e0;
        this._e = e;
        this.I0 = I0;
        this._I = I;
        this.L0 = L0;
        this._L = L;
        this.lp0 = lp0;
        this._lp = lp;
        this.o0 = o0;
        this._o = o;
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

    computeCoordinates(Teph)
    {
        let T = (Teph - 2451545.0)/36525;

        // 1: compute current values of the 6 elements
        let a = this.a0 + this._a * T;
        let e = this.e0 + this._e * T;
        let I = this.I0 + this._I * T;
        let L = this.L0 + this._L * T;
        let lp = this.lp0 + this._lp * T;
        let o = this.o0 + this._o * T;

        // 2: compute perihelion w, and mean anomaly M
        let w = lp - o;
        let M = L - lp;
        if (this.hasAdditionalTerms()) {
            M += this.b * T * T + this.c * cos(this.f * T) + this.s * sin(this.f * T);
        }
        I *= MathUtils.DEG2RAD;
        M *= MathUtils.DEG2RAD;
        w *= MathUtils.DEG2RAD;
        o *= MathUtils.DEG2RAD;

        //console.log('M %s, e %s, i %s, o %s, w %s', M, e, I, o, w);

        // 3: Mod M: -180 < M < 180, and calculate eccentric anomaly E
        // M += 180.0;
        // M = M % 360.0;
        // M -= 180.0;
        let E = solveEccentricAnomaly(e, M);
        
        E %= CIRCLE;
		I %= CIRCLE;
		o %= CIRCLE;
		w %= CIRCLE;
		M %= CIRCLE;
        e %= CIRCLE;

        //console.log(e, 1 - e*e);

        this.computedPosition.set(a * (Math.cos(E) - e), 0, a * (Math.sqrt(1 - (e * e))) * Math.sin(E));
    }

    update()
    {
        this.mesh.position.copy(this.computedPosition);
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