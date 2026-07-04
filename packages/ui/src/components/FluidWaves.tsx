import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    
    vec3 pos = position;
    float elevation = sin(pos.x * 2.0 + uTime * 0.5) * 0.15;
    elevation += sin(pos.y * 3.0 + uTime * 0.3) * 0.1;
    elevation += sin((pos.x + pos.y) * 1.5 + uTime * 0.4) * 0.08;
    pos.z += elevation;
    
    vElevation = elevation;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    float mixFactor = (vElevation + 0.3) * 2.0;
    vec3 color = mix(uColor1, uColor2, mixFactor);
    
    float alpha = 0.7 + vElevation * 0.5;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

function WavePlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#5B2EFF') },
      uColor2: { value: new THREE.Color('#FF4D9D') },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-0.5, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[8, 8, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  );
}

export function FluidWaves({ className = '' }: { className?: string }) {
  return (
    <div className={`fluid-waves ${className}`} style={{ position: 'relative', overflow: 'hidden' }}>
      <Canvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        camera={{ position: [0, 1, 3], fov: 50 }}
        gl={{ alpha: true }}
      >
        <WavePlane />
      </Canvas>
    </div>
  );
}

export default FluidWaves;
