import React, { useState, useEffect, useRef } from 'react';

// Simulated 3D visualization component
const Viewer3D = ({ isRunning }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [fps, setFps] = useState(60);
  
  useEffect(() => {
    if (!canvasRef.current || !isRunning) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let time = 0;
    let frameCount = 0;
    let lastFpsUpdate = Date.now();
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    
    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      
      // Clear with dark background
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, w, h);
      
      // Draw rotating sphere-like particle system
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.3;
      
      // Draw particles on sphere surface
      for (let i = 0; i < 200; i++) {
        const phi = (i / 200) * Math.PI * 2 + time * 0.5;
        const theta = Math.acos(2 * ((i * 0.618033988749895) % 1) - 1);
        
        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        const z = Math.cos(theta);
        
        // Rotate around Y axis
        const rotY = time * 0.3;
        const rx = x * Math.cos(rotY) - z * Math.sin(rotY);
        const rz = x * Math.sin(rotY) + z * Math.cos(rotY);
        
        // Project to 2D with perspective
        const perspective = 2 / (2 - rz);
        const screenX = centerX + rx * radius * perspective;
        const screenY = centerY + y * radius * perspective;
        
        // Color based on position (HSV-like)
        const hue = (phi / (Math.PI * 2) + time * 0.1) % 1;
        const brightness = 0.5 + rz * 0.5;
        const size = 2 + perspective * 3;
        
        // Draw glowing particle
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 2);
        const color = `hsl(${hue * 360}, 80%, ${brightness * 60 + 20}%)`;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Draw connecting lines
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.1)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 50; i++) {
        const angle1 = time + i * 0.3;
        const angle2 = time + i * 0.3 + 2;
        ctx.beginPath();
        ctx.moveTo(
          centerX + Math.cos(angle1) * radius * 0.8,
          centerY + Math.sin(angle1) * radius * 0.8
        );
        ctx.lineTo(
          centerX + Math.cos(angle2) * radius * 1.2,
          centerY + Math.sin(angle2) * radius * 0.6
        );
        ctx.stroke();
      }
      
      time += 0.016;
      frameCount++;
      
      if (Date.now() - lastFpsUpdate > 500) {
        setFps(Math.round(frameCount * 2));
        frameCount = 0;
        lastFpsUpdate = Date.now();
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);
  
  return (
    <div className="relative w-full h-full bg-[#0a0a12]">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        style={{ display: isRunning ? 'block' : 'none' }}
      />
      {!isRunning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">Press Run to start</p>
          <p className="text-xs mt-1 opacity-60">or Ctrl+Enter</p>
        </div>
      )}
      {isRunning && (
        <>
          <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs font-mono text-emerald-400 backdrop-blur-sm">
            {fps} FPS
          </div>
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button className="p-2 rounded bg-black/60 text-white/70 hover:text-white hover:bg-black/80 backdrop-blur-sm transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button className="p-2 rounded bg-black/60 text-white/70 hover:text-white hover:bg-black/80 backdrop-blur-sm transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Simulated code editor component
const CodeEditor = ({ code }) => {
  const lines = code.split('\n');
  
  const highlightSyntax = (line) => {
    // Simple syntax highlighting
    return line
      .replace(/(#include|using|namespace|struct|void|override|double|float|int|return|while|for|if|true|false)/g, '<span class="text-fuchsia-400">$1</span>')
      .replace(/(".*?")/g, '<span class="text-amber-300">$1</span>')
      .replace(/(\/\/.*$)/g, '<span class="text-gray-500">$1</span>')
      .replace(/\b(App|Graphics|Mesh|Vec3f|HSV|AudioIOData|Keyboard|nav|addSphere|generateNormals|clear|depthTesting|lighting|rotate|color|draw|pos|configureAudio|start|out|io)\b/g, '<span class="text-cyan-400">$1</span>')
      .replace(/\b(\d+\.?\d*f?)\b/g, '<span class="text-orange-400">$1</span>');
  };
  
  return (
    <div className="h-full overflow-auto bg-[#12121a] font-mono text-sm leading-6">
      <div className="flex">
        {/* Line numbers */}
        <div className="sticky left-0 flex-shrink-0 py-4 pr-4 pl-4 text-right text-gray-600 select-none bg-[#12121a] border-r border-gray-800/50">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code content */}
        <div className="flex-1 py-4 pl-4 pr-8 overflow-x-auto">
          {lines.map((line, i) => (
            <div 
              key={i} 
              className="whitespace-pre text-gray-300 hover:bg-white/5"
              dangerouslySetInnerHTML={{ __html: highlightSyntax(line) || '&nbsp;' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Console component
const Console = ({ logs, isCompiling }) => {
  return (
    <div className="h-full flex flex-col bg-[#0d0d14]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Console</span>
        <div className="flex-1" />
        <button className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-xs">
        {isCompiling && (
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Compiling...
          </div>
        )}
        {logs.map((log, i) => (
          <div 
            key={i} 
            className={`py-0.5 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-emerald-400' : 
              log.type === 'warning' ? 'text-amber-400' : 
              'text-gray-400'
            }`}
          >
            <span className="text-gray-600">[{log.time}]</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

// Examples modal
const ExamplesModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  
  const examples = [
    { id: 'sphere', name: 'Hello Sphere', desc: 'Rotating colored sphere', category: 'Basics' },
    { id: 'synth', name: 'Simple Synth', desc: 'Keyboard-controlled synthesizer', category: 'Audio' },
    { id: 'particles', name: 'Particle System', desc: '3D particle physics', category: 'Graphics' },
    { id: 'shader', name: 'Custom Shader', desc: 'Fragment shader demo', category: 'Advanced' },
    { id: 'fft', name: 'FFT Visualizer', desc: 'Audio frequency analysis', category: 'Audio' },
    { id: 'mesh', name: 'Mesh Generation', desc: 'Procedural geometry', category: 'Graphics' },
  ];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#16161e] rounded-xl border border-gray-800 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Example Projects</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-3">
            {examples.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex.id)}
                className="text-left p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-cyan-500/50 hover:bg-gray-800 transition-all group"
              >
                <div className="text-xs text-cyan-400 font-medium mb-1">{ex.category}</div>
                <div className="font-medium text-white group-hover:text-cyan-300 transition-colors">{ex.name}</div>
                <div className="text-sm text-gray-500 mt-1">{ex.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App
export default function AllolibStudioMockup() {
  const [isRunning, setIsRunning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState(50);
  const [consoleHeight, setConsoleHeight] = useState(25);
  const [logs, setLogs] = useState([
    { time: '12:34:01', type: 'info', message: 'AlloLib Studio Online initialized' },
    { time: '12:34:01', type: 'info', message: 'WebGL2 context created' },
    { time: '12:34:02', type: 'info', message: 'Web Audio API ready (44100 Hz)' },
  ]);
  
  const sampleCode = `#include "al/app/al_App.hpp"
using namespace al;

struct ParticleSphere : App {
    Mesh mesh;
    double phase = 0;
    
    void onCreate() override {
        addSphere(mesh, 1.0, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 5);
    }
    
    void onAnimate(double dt) override {
        phase += dt;
    }
    
    void onDraw(Graphics& g) override {
        g.clear(0.05);
        g.depthTesting(true);
        g.lighting(true);
        
        // Rotate and color the sphere
        g.rotate(phase * 30, 0, 1, 0);
        g.rotate(phase * 15, 1, 0, 0);
        g.color(HSV(phase * 0.1, 0.8, 1));
        g.draw(mesh);
    }
    
    void onSound(AudioIOData& io) override {
        while (io()) {
            float s = 0; // Audio processing here
            io.out(0) = s;
            io.out(1) = s;
        }
    }
};

int main() {
    ParticleSphere app;
    app.configureAudio(44100, 512, 2, 2);
    app.start();
    return 0;
}`;
  
  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), type: 'info', message: 'Stopped' }]);
    } else {
      setIsCompiling(true);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), type: 'info', message: 'Compiling with Emscripten...' }]);
      
      setTimeout(() => {
        setIsCompiling(false);
        setLogs(prev => [...prev, 
          { time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), type: 'success', message: 'Compilation successful (1.2s)' },
          { time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), type: 'info', message: 'Loading WASM module...' },
          { time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), type: 'success', message: 'Running!' }
        ]);
        setIsRunning(true);
      }, 1500);
    }
  };
  
  return (
    <div className="h-screen w-full flex flex-col bg-[#0e0e14] text-white overflow-hidden" style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      {/* Top toolbar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-[#14141c] border-b border-gray-800/70">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">AlloLib Studio</div>
            <div className="text-[10px] text-gray-500 leading-tight">Online</div>
          </div>
        </div>
        
        <div className="h-6 w-px bg-gray-700/50 mx-2" />
        
        {/* Run/Stop button */}
        <button
          onClick={handleRun}
          disabled={isCompiling}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
            isCompiling 
              ? 'bg-gray-700 text-gray-400 cursor-wait' 
              : isRunning 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
        >
          {isCompiling ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Compiling
            </>
          ) : isRunning ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run
            </>
          )}
        </button>
        
        <div className="h-6 w-px bg-gray-700/50 mx-2" />
        
        {/* File operations */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          New
        </button>
        
        <button 
          onClick={() => setShowExamples(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Examples
        </button>
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
        
        <div className="flex-1" />
        
        {/* Status indicators */}
        <div className="flex items-center gap-3 mr-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-500">WebGL2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-500">Audio</span>
          </div>
        </div>
        
        {/* Settings */}
        <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        
        {/* GitHub */}
        <a href="#" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane - Editor + Console */}
        <div 
          className="flex flex-col border-r border-gray-800/50"
          style={{ width: `${leftPaneWidth}%` }}
        >
          {/* Editor tabs */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#12121a] border-b border-gray-800/50">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#1a1a24] border border-gray-700/50 text-sm">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-gray-300">main.cpp</span>
              <button className="text-gray-600 hover:text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button className="p-1 text-gray-600 hover:text-gray-400 rounded hover:bg-gray-800">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {/* Code editor */}
          <div style={{ height: `${100 - consoleHeight}%` }} className="overflow-hidden">
            <CodeEditor code={sampleCode} />
          </div>
          
          {/* Resize handle */}
          <div 
            className="h-1 bg-gray-800/50 hover:bg-cyan-500/50 cursor-row-resize transition-colors"
          />
          
          {/* Console */}
          <div style={{ height: `${consoleHeight}%` }} className="overflow-hidden">
            <Console logs={logs} isCompiling={isCompiling} />
          </div>
        </div>
        
        {/* Resize handle */}
        <div 
          className="w-1 bg-gray-800/50 hover:bg-cyan-500/50 cursor-col-resize transition-colors flex-shrink-0"
        />
        
        {/* Right pane - Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Viewer tabs */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#12121a] border-b border-gray-800/50">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#1a1a24] border border-gray-700/50 text-sm">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-gray-300">Viewer</span>
            </div>
            <div className="flex-1" />
            <div className="text-xs text-gray-500">
              {isRunning ? 'Running • WebGL2' : 'Stopped'}
            </div>
          </div>
          
          {/* 3D Viewer */}
          <div className="flex-1 overflow-hidden">
            <Viewer3D isRunning={isRunning} />
          </div>
        </div>
      </div>
      
      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 bg-[#0a0a10] border-t border-gray-800/50 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>C++17</span>
          <span>UTF-8</span>
          <span>Spaces: 4</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln 1, Col 1</span>
          <span>AlloLib 2.0 • Emscripten 3.1</span>
        </div>
      </div>
      
      {/* Examples Modal */}
      <ExamplesModal 
        isOpen={showExamples} 
        onClose={() => setShowExamples(false)}
        onSelect={(id) => {
          setShowExamples(false);
          setLogs(prev => [...prev, { 
            time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 8), 
            type: 'info', 
            message: `Loaded example: ${id}` 
          }]);
        }}
      />
      
      {/* Import fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </div>
  );
}
