"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

export function ResizableLayout({ left, right }: Props) {
  return (
    <PanelGroup direction="horizontal" className="h-full w-full">
      <Panel defaultSize={38} minSize={25}>
        {left}
      </Panel>
      <PanelResizeHandle className="w-px bg-[var(--color-border)] hover:bg-[rgba(166,166,179,0.4)]" />
      <Panel defaultSize={62} minSize={30}>
        {right}
      </Panel>
    </PanelGroup>
  );
}
