import { AgenticFlow } from '../lib/studio'

interface FlowDetailsModalProps {
  flow: AgenticFlow
  onClose: () => void
  onEdit: () => void
  onExecute: () => void
}

export default function FlowDetailsModal({ flow, onClose, onEdit, onExecute }: FlowDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col my-auto mx-auto overflow-hidden">
        <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{flow.name}</h2>
            {flow.description && (
              <p className="text-gray-600 mt-1">{flow.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-scroll overflow-x-hidden p-6" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <span
                className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                  flow.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : flow.status === 'draft'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {flow.status}
              </span>
            </div>
            {flow.category && (
              <div>
                <p className="text-sm font-medium text-gray-700">Category</p>
                <p className="text-sm text-gray-900 mt-1">{flow.category}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">Nodes</p>
              <p className="text-sm text-gray-900 mt-1">{flow.flow_definition.nodes.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Edges</p>
              <p className="text-sm text-gray-900 mt-1">{flow.flow_definition.edges.length}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Flow Nodes</h3>
            <div className="space-y-3">
              {flow.flow_definition.nodes.map((node, index) => (
                <div key={node.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900">{node.id}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {node.type}
                        </span>
                      </div>
                      {node.agent_id && (
                        <p className="text-sm text-gray-600">Agent: {node.agent_id}</p>
                      )}
                      {node.skill && (
                        <p className="text-sm text-gray-600">Skill: {node.skill}</p>
                      )}
                      {node.input && Object.keys(node.input).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700">Input:</p>
                          <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(node.input, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {flow.flow_definition.edges.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Flow Connections</h3>
              <div className="space-y-2">
                {flow.flow_definition.edges.map((edge, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                    <span className="font-medium">{edge.from}</span>
                    <span>→</span>
                    <span className="font-medium">{edge.to}</span>
                    {edge.condition && (
                      <span className="text-xs text-gray-500">
                        (condition: {JSON.stringify(edge.condition)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-2 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Edit Flow
          </button>
          <button
            onClick={onExecute}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Execute Flow
          </button>
        </div>
      </div>
    </div>
  )
}
