import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioContext: AudioContext | null;
  sourceNode: MediaStreamAudioSourceNode | AudioBufferSourceNode | null;
  isActive: boolean;
  color?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  audioContext, 
  sourceNode, 
  isActive, 
  color = '#818cf8' // Indigo-400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioContext || !sourceNode || !isActive) return;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Gradient effect
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#c084fc'); // Purple-400

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Be careful not to disconnect the source if it's being used elsewhere, 
      // but for this visualizer, we usually tap into a stream.
      // We do not disconnect sourceNode here to allow other nodes to use it.
      analyser.disconnect();
    };
  }, [audioContext, sourceNode, isActive, color]);

  // Clean canvas when inactive
  useEffect(() => {
    if (!isActive && canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
       if (animationRef.current) {
         cancelAnimationFrame(animationRef.current);
       }
    }
  }, [isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={150} 
      className="w-full h-32 md:h-48 rounded-lg bg-slate-900/50 backdrop-blur-sm border border-slate-700 shadow-inner"
    />
  );
};

export default Visualizer;
