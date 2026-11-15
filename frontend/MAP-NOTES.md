# Native Grid Explorer

Execução: cd frontend, npm install, npm run dev. Verificações: npm test, npm run typecheck, npm run build.

O contrato ativo e as instruções de exportação local/API estão em [GRID-CONTRACT.md](GRID-CONTRACT.md). Não há células simuladas nem ingestão executada. O mapa mostra limites IBGE enquanto aguarda arquivos reais. Seleção por célula, consulta de série sob demanda, estatística opcional e grades independentes.

Componentes: ClimateMap renderiza células e contexto estadual; GridCellPanel exibe coordenadas, índices, fonte e série anual; useGridExplorer gerencia catálogo, recortes e cancelamento; gridApi valida os dados. Os mocks antigos estão desconectados do App.
