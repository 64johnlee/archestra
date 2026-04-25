-- Add labels column to MCP catalog entries for label-based tool assignment
ALTER TABLE internal_mcp_catalog ADD COLUMN IF NOT EXISTS mcp_catalog_labels jsonb DEFAULT '[]'::jsonb;

-- Add tool assignment mode to agents table ('manual' | 'automatic', default 'manual')
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tool_assignment_mode text DEFAULT 'manual' CHECK (tool_assignment_mode IN ('manual', 'automatic'));
