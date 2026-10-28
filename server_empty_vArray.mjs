import { randomUUID } from 'crypto';
import {
  OPCUAServer,
  DataType,
  Variant,
  nodesets,
  VariantArrayType,
  MessageSecurityMode,
  SecurityPolicy
} from 'node-opcua';

const READ_WRITE_ACCESS = 'CurrentRead | CurrentWrite';
const SERVER_PORT = Number(process.env.OPCUA_PORT ?? 26543);

const EMPTY_ARRAY_BY_RANK = {
  1: [0],
  2: [0, 0],
  3: [0, 0, 0]
};

const BASIC_TYPE_DEFINITIONS = [
  { browseName: 'Boolean', dataTypeName: 'Boolean', dataType: DataType.Boolean },
  { browseName: 'SByte', dataTypeName: 'SByte', dataType: DataType.SByte, TypedArray: Int8Array },
  { browseName: 'Byte', dataTypeName: 'Byte', dataType: DataType.Byte, TypedArray: Uint8Array },
  { browseName: 'Int16', dataTypeName: 'Int16', dataType: DataType.Int16, TypedArray: Int16Array },
  { browseName: 'UInt16', dataTypeName: 'UInt16', dataType: DataType.UInt16, TypedArray: Uint16Array },
  { browseName: 'Int32', dataTypeName: 'Int32', dataType: DataType.Int32, TypedArray: Int32Array },
  { browseName: 'UInt32', dataTypeName: 'UInt32', dataType: DataType.UInt32, TypedArray: Uint32Array },
  { browseName: 'Int64', dataTypeName: 'Int64', dataType: DataType.Int64 },
  { browseName: 'UInt64', dataTypeName: 'UInt64', dataType: DataType.UInt64 },
  { browseName: 'Float', dataTypeName: 'Float', dataType: DataType.Float, TypedArray: Float32Array },
  { browseName: 'Double', dataTypeName: 'Double', dataType: DataType.Double, TypedArray: Float64Array },
  { browseName: 'String', dataTypeName: 'String', dataType: DataType.String },
  { browseName: 'DateTime', dataTypeName: 'DateTime', dataType: DataType.DateTime }
];

const buildEmptyVariant = (typeDef, rank, dimensions) => new Variant({
  dataType: typeDef.dataType,
  arrayType: rank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix,
  value: typeDef.TypedArray ? new typeDef.TypedArray(0) : [],
  dimensions: rank === 1 ? undefined : dimensions
});

const createArrayFolders = (namespace, parentFolder) => {
  const arraySamplesFolder = namespace.addFolder(parentFolder, {
    browseName: 'vEmptyArray'
  });

  return {
    1: namespace.addFolder(arraySamplesFolder, { browseName: 'vEmptyArray_1D' }),
    2: namespace.addFolder(arraySamplesFolder, { browseName: 'vEmptyArray_2D' }),
    3: namespace.addFolder(arraySamplesFolder, { browseName: 'vEmptyArray_3D' })
  };
};

const populateEmptyArraySamples = (namespace, folders) => {
  for (const [rankText, dimensions] of Object.entries(EMPTY_ARRAY_BY_RANK)) {
    const rank = Number(rankText);

    for (const typeDef of BASIC_TYPE_DEFINITIONS) {
      namespace.addVariable({
        componentOf: folders[rank],
        browseName: `vEmptyArray_${rank}D_${typeDef.browseName}`,
        dataType: typeDef.dataTypeName,
        valueRank: rank,
        arrayDimensions: dimensions,
        accessLevel: READ_WRITE_ACCESS,
        userAccessLevel: READ_WRITE_ACCESS,
        value: buildEmptyVariant(typeDef, rank, dimensions)
      });
    }
  }
};

const constructAddressSpace = (addressSpace) => {
  const namespace = addressSpace.getOwnNamespace();
  const myDevice = namespace.addFolder('ObjectsFolder', {
    browseName: 'MyDevice'
  });

  populateEmptyArraySamples(namespace, createArrayFolders(namespace, myDevice));
};

(async () => {
  try {
    const server = new OPCUAServer({
      port: SERVER_PORT,
      nodeset_filename: [
        nodesets.standard,
        nodesets.di
      ],
      buildInfo: {
        productName: 'Sample NodeOPCUA Empty vArray Server',
        buildNumber: randomUUID().slice(0, 8),
        buildDate: new Date()
      },
      securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256]
    });

    await server.initialize();
    constructAddressSpace(server.engine.addressSpace);
    await server.start();

    console.log('Server is now listening ... ( press CTRL+C to stop) ');

    server.endpoints[0].endpointDescriptions().forEach((endpoint) => {
      console.log(endpoint.endpointUrl, MessageSecurityMode[endpoint.securityMode], endpoint.securityPolicyUri.toString().padEnd(60));
      console.log('    ', endpoint.userIdentityTokens.map((token) => token.policyId.toString()).join(' '));
    });

    await new Promise((resolve) => process.once('SIGINT', resolve));
    await server.shutdown();
    console.log('server shutdown completed !');
  } catch (err) {
    console.log(err.message);
    process.exit(-1);
  }
})();