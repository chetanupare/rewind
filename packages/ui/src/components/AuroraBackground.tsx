import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    
    float noise1 = sin(uv.x * 3.0 + uTime * 0.5) * cos(uv.y * 2.0 + uTime * 0.3) * 0.5 + 0.5;
    float noise2 = sin(uv.x * 5.0 - uTime * 0.4) * cos(uv.y * 4.0 + uTime * 0.6) * 0.5 + 0.5;
    float noise3 = sin(uv.x * 2.0 + uTime * 0.2) * sin(uv.y * 3.0 - uTime * 0.5) * 0.5 + 0.5;
    
    vec3 color = mix(uColor1, uColor2, noise1);
    color = mix(color, uColor3, noise2 * 0.5);
    
    float alpha = 0.6 + noise3 * 0.4;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

function AuroraPlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#5B2EFF') },
      uColor2: { value: new THREE.Color('#8A3FFC') },
      uColor3: { value: new THREE.Color('#FF4D9D') },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[4, 4, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function AuroraBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`aurora-bg ${className}`} style={{ position: 'relative', overflow: 'hidden' }}>
      <Canvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        camera={{ position: [0, 0, 2], fov: 45 }}
        gl={{ alpha: true }}
      >
        <AuroraPlane />
      </Canvas>
    </div>
  );
}

export default AuroraBackground;
