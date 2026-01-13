import * as THREE from 'three/webgpu';

export default class startfield
{
    constructor(config, scene)
    {
        this.config = config;
        this.stars = [];

        // const sprite = new THREE.TextureLoader().load( 'data/star.png' );
        // sprite.colorSpace = THREE.SRGBColorSpace;
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        let vector = new THREE.Vector3();
        
        for (let i = 0; i < 1024-256; ++i)
        {
            vector.randomDirection();
            vector.multiplyScalar(250 + 750 * Math.random());
            vertices.push(vector.x, vector.y, vector.z)
        }
        geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        const particles = new THREE.Points( geometry );
        scene.add( particles );
    }
}