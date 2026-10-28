import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';
import {
  OPCUAServer,
  OPCUACertificateManager,
  DataType,
  Variant,
  nodesets,
  VariantArrayType,
  MessageSecurityMode,
  SecurityPolicy
} from 'node-opcua';

const READ_WRITE_ACCESS = 'CurrentRead | CurrentWrite';
const SERVER_HOSTNAME = '192.168.100.20';
const SERVER_APPLICATION_URI = 'urn:liutao-Virtual-Machine:NodeOPCUA-Server';
const SERVER_PKI_FOLDER = path.join(process.cwd(), '.opcua-pki');
const SERVER_CERTIFICATE_FILE = path.join(SERVER_PKI_FOLDER, 'own', 'certs', 'server_certificate.pem');

const createServerCertificateManager = async () => {
  const certificateManager = new OPCUACertificateManager({ rootFolder: SERVER_PKI_FOLDER });
  await certificateManager.initialize();

  if (!existsSync(SERVER_CERTIFICATE_FILE)) {
    await certificateManager.createSelfSignedCertificate({
      applicationUri: SERVER_APPLICATION_URI,
      dns: ['localhost', 'liutao-Virtual-Machine-IED'],
      ip: [SERVER_HOSTNAME],
      outputFile: SERVER_CERTIFICATE_FILE,
      subject: 'CN=NodeOPCUA@192.168.100.20',
      startDate: new Date(),
      validity: 3650
    });
  }

  return certificateManager;
};

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
const STRING_ARRAY_PAYLOAD_BYTES = 3 * 1024;
const OUTLIER_LARGE_1D_DIMENSIONS = [65535];
const OUTLIER_LARGE_2D_DIMENSIONS = [256, 256];
const OUTLIER_LARGE_3D_DIMENSIONS = [40, 40, 40];
const OUTLIER_MAX_DIMENSION_VALUE = 4294967295;
const INT64_MAX_VALUE = (1n << 63n) - 1n;
const UINT64_MAX_VALUE = (1n << 64n) - 1n;
const INT64_STEP_VALUE = 10000n;
const UINT64_STEP_VALUE = 10000n;
const MQTT_COMPATIBLE_DATE_TIME_MAX_VALUE = Date.UTC(2024, 11, 31, 23, 59, 59, 999);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const STRING_UTF8_PARTS = ['AS  C I\\t\\rI', '', 'µ', '中日韩', '😀', 'aµ中😀'];
const STRING_VALUE_PREFIX = STRING_UTF8_PARTS.join('-');

const getOffset = (index) => index - 1;

const getNumberFromMaximum = (maximumValue) => (index) => maximumValue - getOffset(index);
const getExponentialValue = (maximumExponent) => (index) => 10 ** (maximumExponent - getOffset(index));
const getDateTimeFromMaximum = (index) => new Date(MQTT_COMPATIBLE_DATE_TIME_MAX_VALUE - getOffset(index) * MILLISECONDS_PER_DAY);
const getUInt64PartsFromMaximum = (maximumValue, stepValue) => (index) => {
  const value = maximumValue - BigInt(getOffset(index)) * stepValue;
  return [Number((value >> 32n) & 0xffffffffn), Number(value & 0xffffffffn)];
};

const scalarOutlierVariant = (dataType, value) => new Variant({
  dataType,
  arrayType: VariantArrayType.Scalar,
  value
});

const arrayOutlierVariant = (dataType, value, dimensions) => new Variant({
  dataType,
  arrayType: dimensions ? VariantArrayType.Matrix : VariantArrayType.Array,
  value,
  dimensions
});

const TYPED_ARRAY_BY_DATA_TYPE = new Map([
  [DataType.SByte, Int8Array],
  [DataType.Byte, Uint8Array],
  [DataType.Int16, Int16Array],
  [DataType.UInt16, Uint16Array],
  [DataType.Int32, Int32Array],
  [DataType.UInt32, Uint32Array],
  [DataType.Float, Float32Array],
  [DataType.Double, Float64Array]
]);

const SAMPLE_TYPE_DEFINITIONS = [
  {
    browseName: 'Boolean',
    dataTypeName: 'Boolean',
    dataType: DataType.Boolean,
    valueAt: (index) => index % 2 === 0,
    initialValueAt: (index) => index % 2 === 1
  },
  {
    browseName: 'SByte',
    dataTypeName: 'SByte',
    dataType: DataType.SByte,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(127)
  },
  {
    browseName: 'Byte',
    dataTypeName: 'Byte',
    dataType: DataType.Byte,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(255)
  },
  {
    browseName: 'Int16',
    dataTypeName: 'Int16',
    dataType: DataType.Int16,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(32767)
  },
  {
    browseName: 'UInt16',
    dataTypeName: 'UInt16',
    dataType: DataType.UInt16,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(65535)
  },
  {
    browseName: 'Int32',
    dataTypeName: 'Int32',
    dataType: DataType.Int32,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(2147483647)
  },
  {
    browseName: 'UInt32',
    dataTypeName: 'UInt32',
    dataType: DataType.UInt32,
    valueAt: (index) => index,
    initialValueAt: getNumberFromMaximum(4294967295)
  },
  {
    browseName: 'Int64',
    dataTypeName: 'Int64',
    dataType: DataType.Int64,
    valueAt: (index) => [0, index],
    initialValueAt: getUInt64PartsFromMaximum(INT64_MAX_VALUE, INT64_STEP_VALUE)
  },
  {
    browseName: 'UInt64',
    dataTypeName: 'UInt64',
    dataType: DataType.UInt64,
    valueAt: (index) => [0, index],
    initialValueAt: getUInt64PartsFromMaximum(UINT64_MAX_VALUE, UINT64_STEP_VALUE)
  },
  {
    browseName: 'Float',
    dataTypeName: 'Float',
    dataType: DataType.Float,
    valueAt: (index) => index + 0.25,
    initialValueAt: getExponentialValue(38)
  },
  {
    browseName: 'Double',
    dataTypeName: 'Double',
    dataType: DataType.Double,
    valueAt: (index) => index + 0.125,
    initialValueAt: getExponentialValue(308)
  },
  {
    browseName: 'String',
    dataTypeName: 'String',
    dataType: DataType.String,
    valueAt: (index) => `value-${index}`,
    initialValueAt: (index) => `${STRING_VALUE_PREFIX}-value-max-${1000000 - getOffset(index)}`
  },
  {
    browseName: 'DateTime',
    dataTypeName: 'DateTime',
    dataType: DataType.DateTime,
    // valueAt: (index) => new Date(Date.UTC(2024, 0, index, 12, 0, 0)),
    // initialValueAt: getDateTimeFromMaximum
    valueAt: (index) => new Date(),
    initialValueAt: (index) => new Date()
  }
];

const getElementCount = (dimensions) => dimensions.reduce((count, dimension) => count * dimension, 1);

const buildUInt32Sequence = (dimensions) => {
  const elementCount = getElementCount(dimensions);
  return Uint32Array.from({ length: elementCount }, (_, index) => index + 1);
};

const buildStringArrayPayload = (dimensions) => {
  const elementCount = getElementCount(dimensions);
  const bytesPerElement = STRING_ARRAY_PAYLOAD_BYTES / elementCount;
  return Array.from({ length: elementCount }, () => 'x'.repeat(bytesPerElement));
};

const coerceArrayValues = (typeDef, values) => {
  const TypedArray = TYPED_ARRAY_BY_DATA_TYPE.get(typeDef.dataType);
  return TypedArray ? new TypedArray(values) : values;
};

const buildValues = (typeDef, dimensions) => {
  const elementCount = getElementCount(dimensions);
  const values = Array.from({ length: elementCount }, (_, index) => typeDef.initialValueAt(index + 1));
  return coerceArrayValues(typeDef, values);
};

const buildRepeatedValues = (typeDef, dimensions, cycleValue) => {
  const elementCount = getElementCount(dimensions);
  const value = typeDef.initialValueAt(cycleValue);
  const values = Array.from({ length: elementCount }, () => value);
  return coerceArrayValues(typeDef, values);
};

const dimensionsKey = (dimensions) => dimensions.join('x');

const createCachedDynamicVariantGetter = (typeDef, rank, getCurrentDimensions) => {
  const variantByDimensions = new Map();

  return () => {
    const dimensions = getCurrentDimensions();
    const key = dimensionsKey(dimensions);
    let variant = variantByDimensions.get(key);

    if (!variant) {
      variant = buildVariant(typeDef, dimensions, rank);
      variantByDimensions.set(key, variant);
    }

    return variant;
  };
};

const createCachedRepeatedVariantGetter = (typeDef, rank, dimensions) => {
  const variants = DYNAMIC_SIZE_SEQUENCE.map((cycleValue) => buildVariant(
    typeDef,
    dimensions,
    rank,
    buildRepeatedValues(typeDef, dimensions, cycleValue)
  ));
  let nextVariantIndex = 0;

  return () => {
    const variant = variants[nextVariantIndex];
    nextVariantIndex = (nextVariantIndex + 1) % variants.length;
    return variant;
  };
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
  getCurrentValues,
  getCurrentVariant
}) => {
  namespace.addVariable({
    componentOf,
    browseName,
    dataType: typeDef.dataTypeName,
    valueRank: rank,
    arrayDimensions,
    minimumSamplingInterval: 1000,
    accessLevel: READ_WRITE_ACCESS,
    userAccessLevel: READ_WRITE_ACCESS,
    value: {
      get: () => {
        if (getCurrentVariant) {
          return getCurrentVariant();
        }

        const dimensions = getCurrentDimensions();
        const values = getCurrentValues?.(dimensions);
        return buildVariant(typeDef, dimensions, rank, values);
      }
    }
  });
};

const addGeneratedScalarVariable = (namespace, componentOf, typeDef, getCurrentStep) => {
  const variants = Array.from({ length: 10 }, (_, index) => new Variant({
    dataType: typeDef.dataType,
    arrayType: VariantArrayType.Scalar,
    value: typeDef.initialValueAt(index + 1)
  }));

  namespace.addVariable({
    componentOf,
    browseName: `vScalar_${typeDef.browseName}`,
    dataType: typeDef.dataTypeName,
    minimumSamplingInterval: 1000,
    accessLevel: READ_WRITE_ACCESS,
    userAccessLevel: READ_WRITE_ACCESS,
    value: {
      get: () => variants[getCurrentStep() - 1]
    }
  });
};

const addOutlierVariable = (namespace, componentOf, {
  browseName,
  dataTypeName,
  dataType,
  value,
  arrayType = VariantArrayType.Scalar,
  valueRank,
  arrayDimensions,
  dimensions
}) => {
  const variant = new Variant({
    dataType,
    arrayType,
    value,
    dimensions
  });

  namespace.addVariable({
    componentOf,
    browseName,
    dataType: dataTypeName,
    ...(valueRank === undefined ? {} : { valueRank }),
    ...(arrayDimensions ? { arrayDimensions } : {}),
    minimumSamplingInterval: 1000,
    accessLevel: READ_WRITE_ACCESS,
    userAccessLevel: READ_WRITE_ACCESS,
    value: variant
  });
};

const populateOutlierSamples = (namespace, parentFolder) => {
  const outlierFolder = namespace.addFolder(parentFolder, {
    browseName: 'vOutlier'
  });

  for (const [rank, dimensions] of [[1, [64]], [2, [8, 8]], [3, [4, 4, 4]]]) {
    addOutlierVariable(namespace, outlierFolder, {
      browseName: `vOutlier_payload3KiB_String_${rank}D`,
      dataTypeName: 'String',
      dataType: DataType.String,
      valueRank: rank,
      arrayDimensions: dimensions,
      arrayType: rank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix,
      ...(rank === 1 ? {} : { dimensions }),
      value: buildStringArrayPayload(dimensions)
    });
  }

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_invalidIrregularArray_Variant',
    dataTypeName: 'BaseDataType',
    dataType: DataType.Variant,
    valueRank: 1,
    arrayDimensions: [3],
    arrayType: VariantArrayType.Array,
    value: [
      scalarOutlierVariant(DataType.Int32, 1),
      arrayOutlierVariant(DataType.Int32, new Int32Array([2, 3])),
      arrayOutlierVariant(DataType.Variant, [
        arrayOutlierVariant(DataType.Int32, new Int32Array([4]))
      ])
    ]
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_invalidIrregularArray_JSON',
    dataTypeName: 'String',
    dataType: DataType.String,
    value: JSON.stringify([1, [2, 3], [[4]]])
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_mixedScalarArray_Variant',
    dataTypeName: 'BaseDataType',
    dataType: DataType.Variant,
    valueRank: 1,
    arrayDimensions: [2],
    arrayType: VariantArrayType.Array,
    value: [
      scalarOutlierVariant(DataType.Int32, 1),
      arrayOutlierVariant(DataType.Int32, new Int32Array([2, 3]))
    ]
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_empty1D_Int32Array',
    dataTypeName: 'Int32',
    dataType: DataType.Int32,
    valueRank: 1,
    arrayDimensions: [0],
    arrayType: VariantArrayType.Array,
    value: new Int32Array([])
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_empty2D_Int32Matrix',
    dataTypeName: 'Int32',
    dataType: DataType.Int32,
    valueRank: 2,
    arrayDimensions: [2, 0],
    arrayType: VariantArrayType.Matrix,
    dimensions: [2, 0],
    value: new Int32Array([])
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_empty3D_Int32Matrix',
    dataTypeName: 'Int32',
    dataType: DataType.Int32,
    valueRank: 3,
    arrayDimensions: [2, 1, 0],
    arrayType: VariantArrayType.Matrix,
    dimensions: [2, 1, 0],
    value: new Int32Array([])
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_maxAllowedDimension_JSON',
    dataTypeName: 'String',
    dataType: DataType.String,
    value: JSON.stringify({
      arrayDimensions: [OUTLIER_MAX_DIMENSION_VALUE],
      note: 'Maximum UInt32 dimension value; descriptor only, not allocated as payload.'
    })
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_productOverflowDimensions_JSON',
    dataTypeName: 'String',
    dataType: DataType.String,
    value: JSON.stringify({
      arrayDimensions: [OUTLIER_MAX_DIMENSION_VALUE, OUTLIER_MAX_DIMENSION_VALUE],
      product: `${OUTLIER_MAX_DIMENSION_VALUE} * ${OUTLIER_MAX_DIMENSION_VALUE}`,
      note: 'Dimension product overflow case; descriptor only, not allocated as payload.'
    })
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_mixedNumeric_DoubleArray',
    dataTypeName: 'Double',
    dataType: DataType.Double,
    valueRank: 1,
    arrayDimensions: [3],
    arrayType: VariantArrayType.Array,
    value: new Float64Array([1, 2.5, 3])
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_mixedNumeric_Variant',
    dataTypeName: 'BaseDataType',
    dataType: DataType.Variant,
    valueRank: 1,
    arrayDimensions: [3],
    arrayType: VariantArrayType.Array,
    value: [
      scalarOutlierVariant(DataType.Int32, 1),
      scalarOutlierVariant(DataType.Double, 2.5),
      scalarOutlierVariant(DataType.Int32, 3)
    ]
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_mixedTypes_Variant',
    dataTypeName: 'BaseDataType',
    dataType: DataType.Variant,
    valueRank: 1,
    arrayDimensions: [3],
    arrayType: VariantArrayType.Array,
    value: [
      scalarOutlierVariant(DataType.Int32, 1),
      scalarOutlierVariant(DataType.String, 'text'),
      scalarOutlierVariant(DataType.Boolean, true)
    ]
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_payloadLimit_UInt32_1D',
    dataTypeName: 'UInt32',
    dataType: DataType.UInt32,
    valueRank: 1,
    arrayDimensions: OUTLIER_LARGE_1D_DIMENSIONS,
    arrayType: VariantArrayType.Array,
    value: buildUInt32Sequence(OUTLIER_LARGE_1D_DIMENSIONS)
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_payloadLimit_UInt32_2D',
    dataTypeName: 'UInt32',
    dataType: DataType.UInt32,
    valueRank: 2,
    arrayDimensions: OUTLIER_LARGE_2D_DIMENSIONS,
    arrayType: VariantArrayType.Matrix,
    dimensions: OUTLIER_LARGE_2D_DIMENSIONS,
    value: buildUInt32Sequence(OUTLIER_LARGE_2D_DIMENSIONS)
  });

  addOutlierVariable(namespace, outlierFolder, {
    browseName: 'vOutlier_payloadLimit_UInt32_3D',
    dataTypeName: 'UInt32',
    dataType: DataType.UInt32,
    valueRank: 3,
    arrayDimensions: OUTLIER_LARGE_3D_DIMENSIONS,
    arrayType: VariantArrayType.Matrix,
    dimensions: OUTLIER_LARGE_3D_DIMENSIONS,
    value: buildUInt32Sequence(OUTLIER_LARGE_3D_DIMENSIONS)
  });
};

const createArrayFolders = (namespace, parentFolder) => {
  const arraySamplesFolder = namespace.addFolder(parentFolder, {
    browseName: 'vArray'
  });

  const scalarSamplesFolder = namespace.addFolder(parentFolder, {
    browseName: 'vScalar'
  });

  return {
    1: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_1D' }),
    2: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_2D' }),
    3: namespace.addFolder(arraySamplesFolder, { browseName: 'vArray_3D' }),
    scalarSamplesFolder
  };
};

const populateScalarSamples = (namespace, scalarSamplesFolder) => {
  const startTime = Date.now();
  const getCurrentStep = () => Math.floor((Date.now() - startTime) / 1000) % 10 + 1;

  for (const typeDef of SAMPLE_TYPE_DEFINITIONS) {
    addGeneratedScalarVariable(namespace, scalarSamplesFolder, typeDef, getCurrentStep);
  }
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
        getCurrentVariant: createCachedRepeatedVariantGetter(typeDef, rank, dimensions.fixed)
      });

      const getDynamicDimensions = createDynamicDimensionGenerator(rank);
      addGeneratedArrayVariable(namespace, rankFolder, {
        browseName: `vArray_${rank}D_dyn_${typeDef.browseName}`,
        typeDef,
        rank,
        arrayDimensions: dimensions.dynamic,
        getCurrentDimensions: getDynamicDimensions,
        getCurrentVariant: createCachedDynamicVariantGetter(typeDef, rank, getDynamicDimensions)
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
  populateScalarSamples(namespace, folders.scalarSamplesFolder);
  // populateOutlierSamples(namespace, myDevice);
}

(async () => {
  try {
    const serverCertificateManager = await createServerCertificateManager();
    const server = new OPCUAServer({
      port: 26543,
      hostname: SERVER_HOSTNAME,
      alternateHostname: ['localhost', 'liutao-Virtual-Machine-IED'],
      certificateFile: SERVER_CERTIFICATE_FILE,
      privateKeyFile: serverCertificateManager.privateKey,
      serverCertificateManager,
      nodeset_filename: [
        nodesets.standard,
        nodesets.di
      ],
      buildInfo: {
        productName: 'Sample NodeOPCUA vArray Server',
        buildNumber: randomUUID().slice(0, 8),
        buildDate: new Date(2024, 1, 26)
      },
      serverInfo: {
        applicationUri: SERVER_APPLICATION_URI
      },
      serverCapabilities: {
        maxSessions: 100
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
