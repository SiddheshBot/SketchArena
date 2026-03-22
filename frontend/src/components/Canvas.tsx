import { useEffect, useRef, useState, useCallback } from 'react';
import type { DrawStroke } from '../types/game';
import { cn } from '../lib/utils';
import { Trash2 } from 'lucide-react';

interface CanvasProps {
  strokes: DrawStroke[];
  onDraw: (stroke: DrawStroke) => void;
  onClear: () => void;
  isDrawer: boolean;
  className?: string;
}

export function GameCanvas({ strokes, onDraw, onClear, isDrawer, className }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  const updateCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Replay strokes
    let currentPathStarted = false;

    strokes.forEach((stroke) => {
      ctx.strokeStyle = stroke.c;
      ctx.lineWidth = stroke.w;

      if (stroke.t === 0) {
        ctx.beginPath();
        ctx.moveTo(stroke.x, stroke.y);
        currentPathStarted = true;
      } else if (stroke.t === 1 && currentPathStarted) {
        ctx.lineTo(stroke.x, stroke.y);
        ctx.stroke();
      } else if (stroke.t === 2 && currentPathStarted) {
        ctx.lineTo(stroke.x, stroke.y);
        ctx.stroke();
        ctx.closePath();
        currentPathStarted = false;
      }
    });
  }, [strokes]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const pos = getPointerPos(e);
    onDraw({ t: 0, x: pos.x, y: pos.y, c: color, w: brushSize });
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawer) return;
    const pos = getPointerPos(e);
    // Threshold to prevent sending too many points (simple performance optimization)
    onDraw({ t: 1, x: pos.x, y: pos.y, c: color, w: brushSize });
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawer) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const pos = getPointerPos(e);
    onDraw({ t: 2, x: pos.x, y: pos.y, c: color, w: brushSize });
  };

  return (
    <div className={cn("flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm", className)}>
      {isDrawer && (
        <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex gap-1 flex-1">
            {colors.map(c => (
              <button 
                key={c}
                onClick={() => setColor(c)}
                className={cn("w-6 h-6 rounded-full border border-slate-300 ring-offset-2 hover:scale-110 transition-transform", color === c && "ring-2 ring-indigo-500")}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-2 border-l pl-3 border-slate-200">
            <input 
              type="range" 
              min="1" 
              max="40" 
              value={brushSize} 
              onChange={e => setBrushSize(parseInt(e.target.value))}
              className="w-24 accent-indigo-500"
            />
            <button 
              onClick={onClear}
              className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Clear Canvas"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
      
      <div className={cn("relative rounded-lg overflow-hidden border border-slate-200 bg-white", isDrawer ? "cursor-crosshair" : "cursor-default")}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          className="w-full h-auto aspect-[4/3] block bg-white touch-none"
        />
        {!isDrawer && <div className="absolute inset-0 z-10 pointers-events-none" />}
      </div>
    </div>
  );
}
