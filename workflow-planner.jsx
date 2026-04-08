import { useState, useRef, useCallback, useEffect } from "react";

/* ─── PALETTE ─── */
const C = {
  bg:        "#1a1a1a",
  bgDeep:    "#141414",
  surface:   "#252525",
  surfaceUp: "#2e2e2e",
  border:    "#414141",
  borderLt:  "#4a4a4a",
  red:       "#FF0000",
  redDark:   "#AF0404",
  redGlow:   "rgba(255,0,0,0.12)",
  redGlow2:  "rgba(175,4,4,0.25)",
  text:      "#f0f0f0",
  textSec:   "#b0b0b0",
  textDim:   "#707070",
  white:     "#ffffff",
  black:     "#000000",
  success:   "#34d399",
  successBg: "rgba(52,211,153,0.10)",
  warning:   "#fbbf24",
  warningBg: "rgba(251,191,36,0.10)",
  info:      "#60a5fa",
  infoBg:    "rgba(96,165,250,0.10)",
};

const NODE_PALETTE = [
  "#FF0000", "#AF0404", "#60a5fa", "#34d399", "#fbbf24",
  "#c084fc", "#f97316", "#ec4899", "#14b8a6", "#a78bfa",
];

/* ─── DEFAULTS ─── */
const defaultNodes = [
  { id: "1", label: "Project Initiation", x: 50,  y: 50,  color: "#FF0000", status: "done" },
  { id: "2", label: "Planning & Design",  x: 230, y: 50,  color: "#fbbf24", status: "active" },
  { id: "3", label: "Execution Phase",    x: 50,  y: 170, color: "#60a5fa", status: "pending" },
  { id: "4", label: "Quality Review",     x: 230, y: 170, color: "#34d399", status: "pending" },
  { id: "5", label: "Final Delivery",     x: 140, y: 290, color: "#c084fc", status: "pending" },
];
const defaultEdges = [
  { from: "1", to: "2" }, { from: "2", to: "3" },
  { from: "2", to: "4" }, { from: "3", to: "5" }, { from: "4", to: "5" },
];
const defaultTasks = [
  { id: "t1", title: "Site survey & inspection report", category: "PMS", priority: "high", status: "todo", dueDate: "2026-04-12", notes: "" },
  { id: "t2", title: "Drawing revision submission to consultant", category: "TMS", priority: "medium", status: "in-progress", dueDate: "2026-04-10", notes: "" },
  { id: "t3", title: "Cable routing & pathway verification", category: "Installation", priority: "high", status: "todo", dueDate: "2026-04-15", notes: "" },
];

const STATUS_MAP  = { todo: "To Do", "in-progress": "In Progress", done: "Done" };
const PRIO_COLOR  = { high: C.red, medium: C.warning, low: C.info };
const STATUS_CYCLE = ["pending", "active", "done"];
const TASK_CYCLE   = ["todo", "in-progress", "done"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

/* ─── STORAGE ─── */
const mem = {};
const sGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return mem[k] ? JSON.parse(mem[k]) : fb; } };
const sSet = (k, v) => { const s = JSON.stringify(v); try { localStorage.setItem(k, s); } catch { mem[k] = s; } };

/* ─── EDITABLE TEXT ─── */
function Editable({ value, onChange, style }) {
  const [on, setOn] = useState(false);
  const [d, setD] = useState(value);
  const r = useRef();
  useEffect(() => { if (on && r.current) { r.current.focus(); r.current.select(); } }, [on]);
  if (on) return (
    <input ref={r} value={d} onChange={e => setD(e.target.value)}
      onBlur={() => { onChange(d); setOn(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(d); setOn(false); } }}
      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.red}`, color: C.text, fontSize: 11, fontWeight: 600, width: "100%", textAlign: "center", outline: "none", borderRadius: 3, padding: "2px 4px", fontFamily: "inherit", boxSizing: "border-box", ...style }}
    />
  );
  return <span onDoubleClick={() => { setD(value); setOn(true); }} style={{ cursor: "text", userSelect: "none", ...style }}>{value}</span>;
}

/* ─── NODE DIMENSIONS ─── */
const NW = 130, NH = 50, NR = 6;

/* ─── WORKFLOW CANVAS ─── */
function WorkflowCanvas({ nodes, setNodes, edges, setEdges }) {
  const svgRef = useRef();
  const [drag, setDrag] = useState(null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [conn, setConn] = useState(null);
  const [sel, setSel] = useState(null);
  const [cSize, setCSize] = useState({ w: 400, h: 460 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (el) setCSize({ w: el.clientWidth, h: Math.max(460, el.clientHeight) });
  }, []);

  const svgPt = useCallback((cx, cy) => {
    const svg = svgRef.current;
    if (!svg) return { x: cx, y: cy };
    const r = svg.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }, []);

  const pDown = (e, n) => {
    e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    const pt = svgPt(t.clientX, t.clientY);
    setDrag(n.id);
    setOff({ x: pt.x - n.x, y: pt.y - n.y });
    setSel(n.id);
  };

  const pMove = useCallback(e => {
    if (!drag) return;
    const t = e.touches ? e.touches[0] : e;
    const pt = svgPt(t.clientX, t.clientY);
    setNodes(p => p.map(n => n.id === drag ? { ...n, x: Math.max(0, Math.min(cSize.w - NW, pt.x - off.x)), y: Math.max(0, Math.min(cSize.h - NH, pt.y - off.y)) } : n));
  }, [drag, off, cSize, svgPt, setNodes]);

  const pUp = useCallback(() => setDrag(null), []);

  useEffect(() => {
    const o = { passive: false };
    window.addEventListener("mousemove", pMove);
    window.addEventListener("mouseup", pUp);
    window.addEventListener("touchmove", pMove, o);
    window.addEventListener("touchend", pUp);
    return () => {
      window.removeEventListener("mousemove", pMove);
      window.removeEventListener("mouseup", pUp);
      window.removeEventListener("touchmove", pMove);
      window.removeEventListener("touchend", pUp);
    };
  }, [pMove, pUp]);

  const addNode = () => {
    setNodes(p => [...p, { id: uid(), label: "New Step", x: 60 + Math.random() * 180, y: 60 + Math.random() * 280, color: NODE_PALETTE[p.length % NODE_PALETTE.length], status: "pending" }]);
  };

  const delNode = id => { setNodes(p => p.filter(n => n.id !== id)); setEdges(p => p.filter(e => e.from !== id && e.to !== id)); setSel(null); };

  const cycleStatus = id => {
    setNodes(p => p.map(n => n.id !== id ? n : { ...n, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(n.status) + 1) % 3] }));
  };

  const doConnect = id => {
    if (conn && conn !== id && !edges.find(e => e.from === conn && e.to === id)) {
      setEdges(p => [...p, { from: conn, to: id }]);
      setConn(null);
    } else { setConn(conn ? null : id); }
  };

  const cycleColor = id => {
    setNodes(p => p.map(n => {
      if (n.id !== id) return n;
      const i = NODE_PALETTE.indexOf(n.color);
      return { ...n, color: NODE_PALETTE[(i + 1) % NODE_PALETTE.length] };
    }));
  };

  const statusBadge = s => {
    if (s === "done") return { symbol: "✓", bg: C.successBg, fg: C.success };
    if (s === "active") return { symbol: "▶", bg: C.warningBg, fg: C.warning };
    return { symbol: "—", bg: "rgba(255,255,255,0.04)", fg: C.textDim };
  };

  const edgeMid = (a, b) => ({ x: (a.x + NW / 2 + b.x + NW / 2) / 2, y: (a.y + NH / 2 + b.y + NH / 2) / 2 });

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bgDeep }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <Btn onClick={addNode} accent>＋ Add Node</Btn>
        <Btn onClick={() => setConn(conn ? null : "__")} style={conn ? { background: C.red, color: C.white, borderColor: C.red } : {}}>
          {conn ? "● Linking…" : "🔗 Link"}
        </Btn>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: C.textDim, letterSpacing: 0.3 }}>DRAG · DOUBLE-TAP · TAP</span>
      </div>

      {/* Grid background */}
      <svg ref={svgRef} width="100%" height={430} style={{ touchAction: "none", background: `radial-gradient(circle at 50% 50%, #1f1f1f 0%, ${C.bgDeep} 100%)` }}
        onMouseDown={() => setSel(null)} onTouchStart={() => setSel(null)}>
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke={C.border} strokeWidth="0.3" strokeOpacity="0.35" />
          </pattern>
          <marker id="arw" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill={C.textDim} />
          </marker>
          <filter id="nodeGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Edges */}
        {edges.map((e, i) => {
          const a = nodes.find(n => n.id === e.from);
          const b = nodes.find(n => n.id === e.to);
          if (!a || !b) return null;
          const ax = a.x + NW / 2, ay = a.y + NH / 2, bx = b.x + NW / 2, by = b.y + NH / 2;
          const mid = edgeMid(a, b);
          return (
            <g key={i}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={C.borderLt} strokeWidth={1.5} markerEnd="url(#arw)" strokeDasharray="6,4" />
              <circle cx={mid.x} cy={mid.y} r={11} fill="transparent" style={{ cursor: "pointer" }}
                onClick={() => setEdges(p => p.filter(x => !(x.from === e.from && x.to === e.to)))} />
              <rect x={mid.x - 5} y={mid.y - 5} width={10} height={10} rx={2} fill={C.surfaceUp} stroke={C.border} strokeWidth={0.8} style={{ pointerEvents: "none" }} />
              <text x={mid.x} y={mid.y + 3.5} textAnchor="middle" fontSize={7} fill={C.textDim} fontWeight="700" style={{ pointerEvents: "none" }}>✕</text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isSel = sel === node.id;
          const isConn = conn === node.id;
          const sb = statusBadge(node.status);
          return (
            <g key={node.id} onMouseDown={e => pDown(e, node)} onTouchStart={e => pDown(e, node)}
              style={{ cursor: drag === node.id ? "grabbing" : "grab" }}>

              {/* Selection glow */}
              {isSel && <rect x={node.x - 3} y={node.y - 3} width={NW + 6} height={NH + 6} rx={NR + 3} fill="none" stroke={node.color} strokeWidth={1.2} strokeOpacity={0.35} filter="url(#nodeGlow)" />}

              {/* Drop shadow rect */}
              <rect x={node.x} y={node.y} width={NW} height={NH} rx={NR}
                fill={C.surface} filter="url(#shadow)" />

              {/* Main body */}
              <rect x={node.x} y={node.y} width={NW} height={NH} rx={NR}
                fill={C.surface} stroke={isSel ? node.color : C.border} strokeWidth={isSel ? 1.8 : 1} />

              {/* Left color accent stripe */}
              <rect x={node.x} y={node.y} width={4.5} height={NH} rx={0}
                fill={node.color} clipPath={`inset(0 0 0 0 round ${NR}px 0 0 ${NR}px)`} />
              <rect x={node.x} y={node.y} width={4.5} height={NR} fill={node.color} rx={NR} />
              <rect x={node.x} y={node.y + NH - NR} width={4.5} height={NR} fill={node.color} rx={NR} />
              <rect x={node.x} y={node.y + NR / 2} width={4.5} height={NH - NR} fill={node.color} />

              {/* Status badge top-right */}
              <rect x={node.x + NW - 28} y={node.y + 5} width={22} height={15} rx={3} fill={sb.bg} stroke={`${sb.fg}30`} strokeWidth={0.8} />
              <text x={node.x + NW - 17} y={node.y + 15.5} textAnchor="middle" fontSize={9} fontWeight="800" fill={sb.fg} fontFamily="'Outfit', sans-serif">{sb.symbol}</text>

              {/* Label */}
              <foreignObject x={node.x + 10} y={node.y + 5} width={NW - 42} height={NH - 8}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: "flex", alignItems: "center", height: "100%" }}>
                  <Editable value={node.label}
                    onChange={v => setNodes(p => p.map(n => n.id === node.id ? { ...n, label: v } : n))}
                    style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: "left", lineHeight: "1.35", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}
                  />
                </div>
              </foreignObject>

              {/* Connection pulse */}
              {isConn && (
                <rect x={node.x - 2} y={node.y - 2} width={NW + 4} height={NH + 4} rx={NR + 2}
                  fill="none" stroke={C.red} strokeWidth={2} strokeDasharray="5,3">
                  <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                </rect>
              )}

              {/* Action buttons below node when selected */}
              {isSel && (
                <g>
                  {[
                    { label: "↻",  tip: "Status", xOff: 0,  action: () => cycleStatus(node.id), bg: C.surfaceUp, fg: C.textSec, bd: C.border },
                    { label: "🔗", tip: "Link",   xOff: 30, action: () => doConnect(node.id),    bg: isConn ? C.red : C.surfaceUp, fg: isConn ? C.white : C.textSec, bd: isConn ? C.red : C.border },
                    { label: "◐",  tip: "Color",  xOff: 60, action: () => cycleColor(node.id),   bg: node.color, fg: C.white, bd: node.color },
                    { label: "✕",  tip: "Delete", xOff: 90, action: () => delNode(node.id),      bg: "#2a1010", fg: C.red, bd: C.redDark },
                  ].map((a, i) => (
                    <g key={i} onClick={e => { e.stopPropagation(); a.action(); }} style={{ cursor: "pointer" }}>
                      <rect x={node.x + a.xOff + (NW - 116) / 2} y={node.y + NH + 8} width={26} height={22} rx={5}
                        fill={a.bg} stroke={a.bd} strokeWidth={0.8} />
                      <text x={node.x + a.xOff + 13 + (NW - 116) / 2} y={node.y + NH + 22.5} textAnchor="middle"
                        fontSize={11} fill={a.fg} fontFamily="'Outfit', sans-serif">{a.label}</text>
                    </g>
                  ))}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {conn && conn !== "__" && (
        <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", background: C.red, color: C.white, padding: "7px 20px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, boxShadow: `0 4px 20px ${C.redGlow2}` }}>
          TAP ANOTHER NODE TO CONNECT
        </div>
      )}
    </div>
  );
}

/* ─── TASK CARD ─── */
function TaskCard({ task, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const pc = PRIO_COLOR[task.priority] || C.info;
  const isDone = task.status === "done";

  const nextStatus = () => {
    const i = TASK_CYCLE.indexOf(task.status);
    onUpdate({ ...task, status: TASK_CYCLE[(i + 1) % 3] });
  };

  return (
    <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, overflow: "hidden", borderLeft: `3.5px solid ${pc}` }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 12px 12px 14px", gap: 10, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div onClick={e => { e.stopPropagation(); nextStatus(); }}
          style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isDone ? C.success : task.status === "in-progress" ? C.warning : C.border}`, background: isDone ? C.successBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}>
          {isDone && <span style={{ color: C.success, fontSize: 12, fontWeight: 800 }}>✓</span>}
          {task.status === "in-progress" && <span style={{ color: C.warning, fontSize: 7 }}>●</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? C.textDim : C.text, textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
            <Tag color={pc}>{task.priority}</Tag>
            {task.category && <Tag color={C.textSec}>{task.category}</Tag>}
            {task.dueDate && <span style={{ fontSize: 10, color: C.textDim }}>◷ {task.dueDate}</span>}
          </div>
        </div>

        <span style={{ fontSize: 11, color: C.textDim, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ paddingTop: 12 }}>
            <Label>Title</Label>
            <Input value={task.title} onChange={e => onUpdate({ ...task, title: e.target.value })} />

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>Priority</Label>
                <Select value={task.priority} onChange={e => onUpdate({ ...task, priority: e.target.value })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Status</Label>
                <Select value={task.status} onChange={e => onUpdate({ ...task, status: e.target.value })}>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </Select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>Category</Label>
                <Input value={task.category} onChange={e => onUpdate({ ...task, category: e.target.value })} placeholder="PMS, TMS…" />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Due Date</Label>
                <Input type="date" value={task.dueDate} onChange={e => onUpdate({ ...task, dueDate: e.target.value })} />
              </div>
            </div>

            <Label>Notes</Label>
            <textarea value={task.notes} onChange={e => onUpdate({ ...task, notes: e.target.value })}
              style={{ ...inputBase, minHeight: 56, resize: "vertical" }} placeholder="Add notes…" />

            <button onClick={() => onDelete(task.id)}
              style={{ width: "100%", marginTop: 10, padding: "9px 0", background: "rgba(255,0,0,0.06)", border: `1px solid ${C.redDark}`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Delete Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MICRO COMPONENTS ─── */
function Btn({ children, onClick, accent, style: s }) {
  return (
    <button onClick={onClick} style={{
      background: accent ? C.red : C.surfaceUp, border: `1px solid ${accent ? C.red : C.border}`,
      color: accent ? C.white : C.textSec, padding: "6px 14px", borderRadius: 6, fontSize: 11,
      fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.3, transition: "all 0.15s", ...s
    }}>{children}</button>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}15`, padding: "2px 7px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.6, border: `1px solid ${color}25` }}>{children}</span>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, marginTop: 12 }}>{children}</div>;
}

const inputBase = {
  width: "100%", padding: "9px 10px", background: C.bgDeep, border: `1px solid ${C.border}`,
  borderRadius: 6, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

function Input(props) {
  return <input {...props} style={inputBase} onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />;
}

function Select({ children, ...props }) {
  return <select {...props} style={{ ...inputBase, appearance: "auto" }}>{children}</select>;
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState("workflow");
  const [nodes, setNodes] = useState(() => sGet("wf-n", defaultNodes));
  const [edges, setEdges] = useState(() => sGet("wf-e", defaultEdges));
  const [tasks, setTasks] = useState(() => sGet("wf-t", defaultTasks));
  const [filter, setFilter] = useState("all");

  useEffect(() => sSet("wf-n", nodes), [nodes]);
  useEffect(() => sSet("wf-e", edges), [edges]);
  useEffect(() => sSet("wf-t", tasks), [tasks]);

  const addTask = () => setTasks(p => [{ id: uid(), title: "New Task", category: "", priority: "medium", status: "todo", dueDate: "", notes: "" }, ...p]);
  const updTask = t => setTasks(p => p.map(x => x.id === t.id ? t : x));
  const delTask = id => setTasks(p => p.filter(x => x.id !== id));

  const cnt = { all: tasks.length, todo: tasks.filter(t => t.status === "todo").length, "in-progress": tasks.filter(t => t.status === "in-progress").length, done: tasks.filter(t => t.status === "done").length };
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  const progress = cnt.all ? Math.round((cnt.done / cnt.all) * 100) : 0;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: C.bgDeep, minHeight: "100vh", color: C.text, maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* ─── HEADER ─── */}
      <div style={{ padding: "20px 18px 16px", background: C.surface, borderBottom: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.red}, ${C.redDark}, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: C.white, lineHeight: 1 }}>
              WORK<span style={{ color: C.red }}>FLOW</span>
            </div>
            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 2.5, fontWeight: 500, marginTop: 3, textTransform: "uppercase" }}>Plan · Track · Deliver</div>
          </div>
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke={C.border} strokeWidth="3" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={C.red} strokeWidth="3"
                strokeDasharray={`${progress * 1.13} 200`} strokeLinecap="round"
                transform="rotate(-90 22 22)" style={{ transition: "stroke-dasharray 0.5s" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.text }}>{progress}%</div>
          </div>
        </div>
      </div>

      {/* ─── TAB BAR ─── */}
      <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {[
          { key: "workflow", label: "WORKFLOW", icon: "⬡" },
          { key: "planner", label: "PLANNER", icon: "☰" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "12px 0", fontSize: 11, fontWeight: 700, letterSpacing: 1.8, background: "none", border: "none",
            color: tab === t.key ? C.red : C.textDim,
            borderBottom: tab === t.key ? `2.5px solid ${C.red}` : "2.5px solid transparent",
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s"
          }}>{t.icon}  {t.label}</button>
        ))}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>

        {tab === "workflow" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>Workflow Chart</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{nodes.length} nodes · {edges.length} links</div>
              </div>
              <Btn onClick={() => { setNodes(defaultNodes); setEdges(defaultEdges); }}>↺ RESET</Btn>
            </div>

            <WorkflowCanvas nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges} />

            <div style={{ display: "flex", gap: 16, marginTop: 14, justifyContent: "center" }}>
              {[
                { s: "—", l: "Pending", c: C.textDim },
                { s: "▶", l: "Active", c: C.warning },
                { s: "✓", l: "Done", c: C.success },
              ].map(x => (
                <span key={x.l} style={{ fontSize: 10, color: x.c, fontWeight: 600, letterSpacing: 0.3 }}>{x.s} {x.l}</span>
              ))}
            </div>

            <div style={{ marginTop: 14, padding: "12px 14px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 1, marginBottom: 6 }}>QUICK GUIDE</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8 }}>
                <b style={{ color: C.textSec }}>Drag</b> — reposition nodes<br />
                <b style={{ color: C.textSec }}>Double-tap</b> — rename label<br />
                <b style={{ color: C.textSec }}>Tap node</b> — status / link / color / delete<br />
                <b style={{ color: C.textSec }}>Tap ✕ on edge</b> — remove connection
              </div>
            </div>
          </div>
        )}

        {tab === "planner" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>Task Planner</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Manage your work schedule</div>
              </div>
              <Btn onClick={addTask} accent>＋ ADD TASK</Btn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { l: "TO DO", n: cnt.todo, c: C.info, bg: C.infoBg },
                { l: "ACTIVE", n: cnt["in-progress"], c: C.warning, bg: C.warningBg },
                { l: "DONE", n: cnt.done, c: C.success, bg: C.successBg },
              ].map(s => (
                <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: "10px 0", textAlign: "center", border: `1px solid ${s.c}20` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 9, color: s.c, fontWeight: 700, letterSpacing: 1.2, opacity: 0.7 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: 0.5 }}>OVERALL PROGRESS</span>
                <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>{progress}%</span>
              </div>
              <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${C.redDark}, ${C.red})`, borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
              {["all", "todo", "in-progress", "done"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "6px 13px", borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s",
                  background: filter === f ? C.red : C.surfaceUp,
                  color: filter === f ? C.white : C.textDim,
                  border: `1px solid ${filter === f ? C.red : C.border}`,
                }}>
                  {f === "all" ? "ALL" : STATUS_MAP[f]?.toUpperCase()} ({cnt[f]})
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 20px", color: C.textDim }}>
                <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}>☰</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>No tasks in this category</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Tap <b style={{ color: C.red }}>＋ ADD TASK</b> to create one</div>
              </div>
            )}
            {filtered.map(t => <TaskCard key={t.id} task={t} onUpdate={updTask} onDelete={delTask} />)}
          </div>
        )}
      </div>

      {/* ─── BOTTOM NAV ─── */}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.surface }}>
        {[
          { key: "workflow", icon: "⬡", label: "Workflow" },
          { key: "planner", icon: "☰", label: "Planner" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "10px 0 8px", background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            color: tab === t.key ? C.red : C.textDim, fontFamily: "inherit", transition: "color 0.2s",
            position: "relative",
          }}>
            {tab === t.key && <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 2.5, background: C.red, borderRadius: "0 0 2px 2px" }} />}
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{t.label.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
