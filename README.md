# OCI plugin demo marketplace

This branch publishes the OCI-source marketplace for the POC. Install marketplace-manager from main, then add this branch URL through its command:

    /marketplace-manager add https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace

The plugin source uses the configured Quay demo tag. The manager extracts it with ORAS and registers a native-compatible local marketplace. The main branch keeps the native manager bootstrap. No manual clone is required.
