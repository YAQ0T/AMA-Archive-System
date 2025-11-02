# System Diagram

```mermaid
graph LR
    A[Document Scanner] -->|Uploads job + binaries| B[Ingestion Service]
    B -->|Metadata validation| C[Node.js API]
    C -->|Stores metadata & binaries| D[(MongoDB + GridFS)]
    D -->|Serves data via API| C
    C -->|Delivers records & assets| E[React UI]
    E -->|User actions| C
```

The diagram illustrates the flow from scanner ingestion through the Node.js API into MongoDB (using GridFS for binary storage) and exposes the content to the React-based user interface.
