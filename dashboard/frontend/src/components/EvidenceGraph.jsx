import { useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Empty from "./Empty.jsx";
import { IconLink } from "./Icons.jsx";

// Left-to-right layers: artifacts → device → volume → files ← LNK records
const COLUMN = { artifact: 0, device: 1, volume: 2, file: 3, lnk: 4 };
const COL_W = 316, ROW_H = 82;

const LEGEND = [
  ["Artifact source", "var(--good)"],
  ["Device", "var(--accent)"],
  ["Volume", "var(--series-1)"],
  ["File", "var(--warning)"],
  ["Opened (LNK)", "var(--serious)"],
];

function baseName(path) {
  return path.split(/[\\/]/).pop();
}

export default function EvidenceGraph({ graph }) {
  const { nodes, edges } = useMemo(() => {
    const rows = {};
    const nodes = (graph?.nodes || []).map((n) => {
      const col = COLUMN[n.type] ?? 2;
      const row = (rows[col] = (rows[col] ?? -1) + 1);
      const label = n.type === "file" ? baseName(n.label)
        : n.type === "lnk" ? "Opened: " + baseName(n.label.replace(/^LNK: /, ""))
        : n.label;
      return {
        id: n.id,
        position: { x: col * COL_W, y: row * ROW_H },
        data: { label: <><div className="node-type">{n.type}</div><div title={n.label}>{label}</div></> },
        className: `gnode gnode-${n.type}`,
        sourcePosition: "right",
        targetPosition: "left",
      };
    });
    // centre short columns vertically against the tallest one
    const tallest = Math.max(1, ...Object.values(rows).map((r) => r + 1));
    nodes.forEach((n) => {
      const col = Math.round(n.position.x / COL_W);
      n.position.y += ((tallest - (rows[col] + 1)) * ROW_H) / 2;
    });
    const edges = (graph?.edges || []).map((e, i) => {
      // LNK records sit to the right of the files they point at, so draw those
      // edges file → LNK to keep every arrow flowing left to right.
      const flip = e.source.startsWith("lnk:");
      const accessed = e.relation === "accessed";
      return {
        id: `e${i}`,
        source: flip ? e.target : e.source,
        target: flip ? e.source : e.target,
        label: accessed ? "opened (LNK proof)" : e.relation.replace("_", " "),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: accessed ? "var(--serious)" : "var(--border-strong)",
          width: 18, height: 18,
        },
        animated: accessed,
        className: `gedge gedge-${e.relation}`,
      };
    });
    return { nodes, edges };
  }, [graph]);

  if (!nodes.length) return (
    <Empty icon={<IconLink width="28" height="28" />} title="No graph yet">
      The correlation graph appears once the analysis engine has processed this incident.
    </Empty>
  );

  return (
    <>
      <div className="graph">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesConnectable={false} nodesDraggable
                   minZoom={0.3} proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="graph-legend">
        {LEGEND.map(([label, color]) => (
          <span key={label}><i style={{ background: color }} />{label}</span>
        ))}
      </div>
    </>
  );
}
