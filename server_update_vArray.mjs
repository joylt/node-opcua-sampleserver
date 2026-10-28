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

const ARRAY_DIMENSIONS_BY_RANK = {
  1: {
    fixed: [3],
    dynamic: [0]
  },
  2: {
    fixed: [2, 3],
    dynamic: [0, 0]
  },
  3: {
    fixed: [2, 3, 2],
    dynamic: [0, 0, 0]
  }
};

const DYNAMIC_SIZE_SEQUENCE = [1, 2, 3];

const SAMPLE_TYPE_DEFINITIONS = [
  {
    browseName: 'Boolean',
    dataTypeName: 'Boolean',
    dataType: DataType.Boolean,
    valueAt: (index) => index % 2 === 0
  },
  {
    browseName: 'SByte',
    dataTypeName: 'SByte',
    dataType: DataType.SByte,
    valueAt: (index) => index
  },
  {
    browseName: 'Byte',
    dataTypeName: 'Byte',
    dataType: DataType.Byte,
    valueAt: (index) => index
  },
  {
    browseName: 'Int16',
    dataTypeName: 'Int16',
    dataType: DataType.Int16,
    valueAt: (index) => index
  },
  {
    browseName: 'UInt16',
    dataTypeName: 'UInt16',
    dataType: DataType.UInt16,
    valueAt: (index) => index
  },
  {
    browseName: 'Int32',
    dataTypeName: 'Int32',
    dataType: DataType.Int32,
    valueAt: (index) => index
  },
  {
    browseName: 'UInt32',
    dataTypeName: 'UInt32',
    dataType: DataType.UInt32,
    valueAt: (index) => index
  },
  {
    browseName: 'Int64',
    dataTypeName: 'Int64',
    dataType: DataType.Int64,
    valueAt: (index) => [0, index]
  },
  {
    browseName: 'UInt64',
    dataTypeName: 'UInt64',
    dataType: DataType.UInt64,
    valueAt: (index) => [0, index]
  },
  {
    browseName: 'Float',
    dataTypeName: 'Float',
    dataType: DataType.Float,
    valueAt: (index) => index + 0.25
  },
  {
    browseName: 'Double',
    dataTypeName: 'Double',
    dataType: DataType.Double,
    valueAt: (index) => index + 0.125
  },
  {
    browseName: 'String',
    dataTypeName: 'String',
    dataType: DataType.String,
    valueAt: (index) => `value-${index}`
  },
  {
    browseName: 'DateTime',
    dataTypeName: 'DateTime',
    dataType: DataType.DateTime,
    valueAt: (index) => new Date(Date.UTC(2024, 0, index, 12, 0, 0))
  }
];

const getElementCount = (dimensions) => dimensions.reduce((count, dimension) => count * dimension, 1);

const buildValues = (typeDef, dimensions) => {
  const elementCount = getElementCount(dimensions);
  return Array.from({ length: elementCount }, (_, index) => typeDef.valueAt(index + 1));
};

const buildRepeatedValues = (typeDef, dimensions, cycleValue) => {
  const elementCount = getElementCount(dimensions);
  const value = typeDef.valueAt(cycleValue);
  return Array.from({ length: elementCount }, () => value);
};

const createDynamicDimensionGenerator = (rank) => {
  let nextSizeIndex = 0;

  return () => {
    const size = DYNAMIC_SIZE_SEQUENCE[nextSizeIndex];
    nextSizeIndex = (nextSizeIndex + 1) % DYNAMIC_SIZE_SEQUENCE.length;
    return Array.from({ length: rank }, () => size);
  };
};

const getVariantArrayType = (rank) => rank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix;

const buildVariant = (typeDef, dimensions, rank, values = buildValues(typeDef, dimensions)) => new Variant({
  dataType: typeDef.dataType,
  arrayType: getVariantArrayType(rank),
  value: values,
  dimensions: rank === 1 ? undefined : dimensions
});

const addGeneratedArrayVariable = (namespace, componentOf, {
  browseName,
  typeDef,
  rank,
  arrayDimensions,
  getCurrentDimensions,
  getCurrentValues
}) => {
  namespace.addVariable({
    componentOf,
    browseName,
    dataType: typeDef.dataTypeName,
    valueRank: rank,
    arrayDimensions,
    accessLevel: READ_WRITE_ACCESS,
    userAccessLevel: READ_WRITE_ACCESS,
    value: {
      get: () => {
        const dimensions = getCurrentDimensions();
        const values = getCurrentValues?.(dimensions);
        return buildVariant(typeDef, dimensions, rank, values);
      }
    }
  });
};

const createArrayFolders = (namespace, parentFolder) => {
  const arraySamplesFolder = namespace.addFolder(parentFolder, {
    browseName: 'vArray'
  });

  return {
    1: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_1D' }),
    2: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_2D' }),
    3: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_3D' })
  };
};

const populateArraySamples = (namespace, folders) => {
  for (const [rankText, dimensions] of Object.entries(ARRAY_DIMENSIONS_BY_RANK)) {
    const rank = Number(rankText);
    const rankFolder = folders[rank];

    for (const typeDef of SAMPLE_TYPE_DEFINITIONS) {
      addGeneratedArrayVariable(namespace, rankFolder, {
        browseName: `vArray_${rank}D_fixed_${typeDef.browseName}`,
        typeDef,
        rank,
        arrayDimensions: dimensions.fixed,
        getCurrentDimensions: () => dimensions.fixed,
        getCurrentValues: (() => {
          let cycleValue = 0;

          return (currentDimensions) => {
            cycleValue = cycleValue % DYNAMIC_SIZE_SEQUENCE.length + 1;
            return buildRepeatedValues(typeDef, currentDimensions, cycleValue);
          };
        })()
      });

      const getDynamicDimensions = createDynamicDimensionGenerator(rank);
      addGeneratedArrayVariable(namespace, rankFolder, {
        browseName: `vArray_${rank}D_dyn_${typeDef.browseName}`,
        typeDef,
        rank,
        arrayDimensions: dimensions.dynamic,
        getCurrentDimensions: getDynamicDimensions
      });
    }
  }
};

/**
 * @param {IAddressSpace} addressSpace
 */
function constructAddressSpace (addressSpace) {
  const namespace = addressSpace.getOwnNamespace();

  const myDevice = namespace.addFolder('ObjectsFolder', {
    browseName: 'MyDevice'
  });

  const folders = createArrayFolders(namespace, myDevice);
  populateArraySamples(namespace, folders);
}

(async () => {
  try {
    const server = new OPCUAServer({
      port: 26543,
      nodeset_filename: [
        nodesets.standard,
        nodesets.di
      ],
      buildInfo: {
        productName: 'Sample NodeOPCUA vArray Server',
        buildNumber: randomUUID().slice(0, 8),
        buildDate: new Date(2024, 1, 26)
      },
      securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256]
    });

    await server.initialize();

    constructAddressSpace(server.engine.addressSpace);

    await server.start();

    console.log('Server is now listening ... ( press CTRL+C to stop) ');

    server.endpoints[0].endpointDescriptions().forEach((endpoint) => {
      console.log(endpoint.endpointUrl, MessageSecurityMode[endpoint.securityMode], endpoint.securityPolicyUri.toString().padEnd(60));
      console.log('    ', endpoint.userIdentityTokens.map((x) => x.policyId.toString()).join(' '));
    });

    await new Promise((resolve) => process.once('SIGINT', resolve));

    await server.shutdown();
    console.log('server shutdown completed !');
  } catch (err) {
    console.log(err.message);
    process.exit(-1);
  }
})();