import os from 'os';
import {
  OPCUAServer,
  Variant,
  DataType,
  DataValue,
  DiagnosticInfo,
  StatusCodes,
  coerceNodeId,
  coerceExpandedNodeId,
  nodesets,
  VariantArrayType,
  MessageSecurityMode,
  SecurityPolicy
} from 'node-opcua';

/**
 * @param {IAddressSpace} addressSpace
 */
function constructAddressSpace (addressSpace) {
  const namespace = addressSpace.getOwnNamespace();

  // we create a new folder under RootFolder
  const myDevice = namespace.addFolder('ObjectsFolder', {
    browseName: 'MyDevice'
  });

  // now let's add first variable in folder
  // the addVariableInFolder
  const variable1 = 10.0;

  namespace.addVariable({
    componentOf: myDevice,
    nodeId: 's=Temperature',
    browseName: 'Temperature',
    dataType: 'Double',
    minimumSamplingInterval: 500,
    accessLevel: 'CurrentRead',
    value: {
      get: () => {
        const t = new Date() / 10000.0;
        const value = variable1 + 10.0 * Math.sin(t);
        return new Variant({ dataType: DataType.Double, value });
      }
    }
  });

  const uaVariable2 = namespace.addVariable({
    componentOf: myDevice,
    browseName: 'MyVariable2',
    dataType: 'String'
  });
  uaVariable2.setValueFromSource({
    dataType: DataType.String,
    value: 'Learn Node-OPCUA ! Read https://leanpub.com/node-opcuabyexample-edition2024'
  });

  const uaVariable3 = namespace.addVariable({
    componentOf: myDevice,
    browseName: 'MyVariable3',
    dataType: 'Double',
    arrayDimensions: [3],
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite',
    valueRank: 1

  });
  uaVariable3.setValueFromSource({
    dataType: DataType.Double,
    arrayType: VariantArrayType.Array,
    value: [1.0, 2.0, 3.0]
  });

  const uaFloat32Array2D = namespace.addVariable({
    componentOf: myDevice,
    browseName: 'Float32Array2D',
    dataType: 'Float',
    arrayDimensions: [2, 3],
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite',
    valueRank: 2
  });
  uaFloat32Array2D.setValueFromSource({
    dataType: DataType.Float,
    arrayType: VariantArrayType.Matrix,
    value: [1.1, 2.2, 3.3, 4.4, 5.5, 6.6],
    dimensions: [2, 3]
  });

  // One variable per DataType enum member.
  const dataTypeSamplesFolder = namespace.addFolder(myDevice, {
    browseName: 'DataTypeSamples'
  });

  const addScalarSample = (browseName, dataTypeName, dataTypeEnum, value, variantOptions = {}) => {
    const v = namespace.addVariable({
      componentOf: dataTypeSamplesFolder,
      browseName,
      dataType: dataTypeName,
      accessLevel: 'CurrentRead | CurrentWrite',
      userAccessLevel: 'CurrentRead | CurrentWrite'
    });
    v.setValueFromSource({
      dataType: dataTypeEnum,
      value,
      ...variantOptions
    });
  };

  addScalarSample('DT_Null', 'BaseDataType', DataType.Null, null);
  addScalarSample('DT_Boolean', 'Boolean', DataType.Boolean, true);
  addScalarSample('DT_SByte', 'SByte', DataType.SByte, -12);
  addScalarSample('DT_Byte', 'Byte', DataType.Byte, 12);
  addScalarSample('DT_Int16', 'Int16', DataType.Int16, -1234);
  addScalarSample('DT_UInt16', 'UInt16', DataType.UInt16, 1234);
  addScalarSample('DT_Int32', 'Int32', DataType.Int32, -123456);
  addScalarSample('DT_UInt32', 'UInt32', DataType.UInt32, 123456);
  addScalarSample('DT_Int64', 'Int64', DataType.Int64, [-1, 123], { arrayType: VariantArrayType.Scalar });
  addScalarSample('DT_UInt64', 'UInt64', DataType.UInt64, [0, 123], { arrayType: VariantArrayType.Scalar });
  addScalarSample('DT_Float', 'Float', DataType.Float, 12.5);
  addScalarSample('DT_Double', 'Double', DataType.Double, 12.5);
  addScalarSample('DT_String', 'String', DataType.String, 'sample string');
  addScalarSample('DT_DateTime', 'DateTime', DataType.DateTime, new Date());
  addScalarSample('DT_Guid', 'Guid', DataType.Guid, '123e4567-e89b-12d3-a456-426614174000');
  addScalarSample('DT_ByteString', 'ByteString', DataType.ByteString, Buffer.from('sample-bytes'));
  addScalarSample('DT_XmlElement', 'XmlElement', DataType.XmlElement, '<root><value>1</value></root>');
  addScalarSample('DT_NodeId', 'NodeId', DataType.NodeId, coerceNodeId('ns=1;s=NodeIdSample'));
  addScalarSample('DT_ExpandedNodeId', 'ExpandedNodeId', DataType.ExpandedNodeId, coerceExpandedNodeId('ns=1;s=ExpandedNodeIdSample'));
  addScalarSample('DT_StatusCode', 'StatusCode', DataType.StatusCode, StatusCodes.Good);
  addScalarSample('DT_QualifiedName', 'QualifiedName', DataType.QualifiedName, {
    namespaceIndex: 1,
    name: 'QualifiedNameSample'
  });
  addScalarSample('DT_LocalizedText', 'LocalizedText', DataType.LocalizedText, {
    locale: 'en',
    text: 'Localized text sample'
  });
  addScalarSample('DT_ExtensionObject', 'BaseDataType', DataType.ExtensionObject, null);
  addScalarSample('DT_DataValue', 'BaseDataType', DataType.DataValue, new DataValue({
    value: new Variant({ dataType: DataType.Double, value: 42.25 })
  }));
  addScalarSample('DT_Variant', 'BaseDataType', DataType.Variant, new Variant({
    dataType: DataType.Int32,
    value: 99
  }));
  addScalarSample('DT_DiagnosticInfo', 'BaseDataType', DataType.DiagnosticInfo, new DiagnosticInfo({
    additionalInfo: 'diagnostic-info-sample'
  }));

  // One variable per VariantArrayType enum member.
  const arrayTypeSamplesFolder = namespace.addFolder(myDevice, {
    browseName: 'VariantArrayTypeSamples'
  });

  const vScalar = namespace.addVariable({
    componentOf: arrayTypeSamplesFolder,
    browseName: 'VAT_Scalar',
    dataType: 'Int32',
    valueRank: -1,
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite'
  });
  vScalar.setValueFromSource({
    dataType: DataType.Int32,
    arrayType: VariantArrayType.Scalar,
    value: 7
  });

  const vArray = namespace.addVariable({
    componentOf: arrayTypeSamplesFolder,
    browseName: 'VAT_Array',
    dataType: 'Int32',
    valueRank: 1,
    arrayDimensions: [3],
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite'
  });
  vArray.setValueFromSource({
    dataType: DataType.Int32,
    arrayType: VariantArrayType.Array,
    value: [1, 2, 3]
  });

  const vMatrix = namespace.addVariable({
    componentOf: arrayTypeSamplesFolder,
    browseName: 'VAT_Matrix',
    dataType: 'Float',
    valueRank: 2,
    arrayDimensions: [2, 2],
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite'
  });
  vMatrix.setValueFromSource({
    dataType: DataType.Float,
    arrayType: VariantArrayType.Matrix,
    value: [1.1, 2.2, 3.3, 4.4],
    dimensions: [2, 2]
  });

  namespace.addVariable({
    componentOf: myDevice,
    nodeId: 'b=1020ffab',
    browseName: 'Percentage Memory Used',
    dataType: 'Double',
    minimumSamplingInterval: 1000,
    value: {
      get: () => {
        // const value = process.memoryUsage().heapUsed / 1000000;
        const percentageMemUsed = 1.0 - (os.freemem() / os.totalmem());
        const value = percentageMemUsed * 100;
        return new Variant({ dataType: DataType.Double, value });
      }
    }
  });
}

(async () => {
  try {
    // Let create an instance of OPCUAServer
    const server = new OPCUAServer({
      port: 26543, // the port of the listening socket of the server

      nodeset_filename: [
        nodesets.standard,
        nodesets.di
      ],
      buildInfo: {
        productName: 'Sample NodeOPCUA Server1',

        buildNumber: '7658',
        buildDate: new Date(2024, 1, 26)
      },
      securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256 ],
    });

  
    await server.initialize();
   

    constructAddressSpace(server.engine.addressSpace);

    // we can now start the server
    await server.start();

    console.log('Server is now listening ... ( press CTRL+C to stop) ');

    
    server.endpoints[0].endpointDescriptions().forEach((endpoint) => {
      console.log(endpoint.endpointUrl, MessageSecurityMode[endpoint.securityMode], endpoint.securityPolicyUri.toString().padEnd(60));
      console.log("    ", endpoint.userIdentityTokens.map((x) => x.policyId.toString()).join(' '));
    });

    await new Promise((resolve) => process.once('SIGINT', resolve));

    await server.shutdown();
    console.log('server shutdown completed !');
  } catch (err) {
    console.log(err.message);
    process.exit(-1);
  }
})();
