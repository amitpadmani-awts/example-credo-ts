import { CREDENTIALS_CONTEXT_V1_URL, KeyType } from "@credo-ts/core";
import { holder } from "./holder";
import { issuer } from "./issuer";
import { resolve } from "path";
import { BasicMessageRole } from "@credo-ts/didcomm";

const app = async () => {
  // Init issuer agent & wallet
  await issuer.initialize();

  // Init holder agent & wallet
  await holder.initialize();

  // Create issuer DID
  const issuerDIDResult = await issuer.dids.create({
    method: "key",
    options: {
      keyType: KeyType.Ed25519,
    },
  });
  const issuerDID = issuerDIDResult.didState.did;
  console.log("Issuer DID = ", issuerDID);

  // Create holder DID
  const holderDIDResult = await holder.dids.create({
    method: "key",
    options: {
      keyType: KeyType.Ed25519,
    },
  });
  const holderDID = holderDIDResult.didState.did;
  console.log("Holder DID = ", holderDID);

  // Create Offer: Issuer
  const credentialOffer = await issuer.modules.credentials.createOffer({
    credentialFormats: {
      jsonld: {
        credential: {
          "@context": [
            CREDENTIALS_CONTEXT_V1_URL,
            "https://www.w3.org/2018/credentials/examples/v1",
          ],
          type: ["VerifiableCredential", "UniversityDegreeCredential"],
          issuer: issuerDID ?? "",
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: holderDID ?? "",
            degree: {
              type: "BachelorDegree",
              name: "Bachelor of Science and Arts",
            },
          },
        },
        options: {
            proofPurpose: 'assertionMethod',
            proofType: 'Ed25519Signature2018',
        },
      },
    },
    protocolVersion: "v2",
  });

  // Create invitation: Issuer
  const invitation = await issuer.modules.oob.createInvitation({
    messages: [credentialOffer.message]
  })

  // Receive invitation: Holder
  const { connectionRecord } = await holder.modules.oob.receiveInvitation(invitation.outOfBandInvitation)
  if(connectionRecord === undefined) {
    throw new Error("Connection not found...")
  }
  await holder.modules.connections.returnWhenIsConnected(connectionRecord.id)
  await new Promise((resolve) => setTimeout(resolve, 5000))

  const credentialRcords = await holder.modules.credentials.getAll()
  await holder.modules.credentials.acceptOffer({
    credentialRecordId: credentialRcords[0].id
  })

  await new Promise((resolve) => setTimeout(resolve, 10000))

  // Print crdential payload and data
  const credentials = await holder.modules.credentials.getAll()
  console.log('\n\n\n\n CRED = ', JSON.stringify(credentials, null, 2))
  const credMetaData = await holder.modules.credentials.getFormatData(credentials[0].id)
  console.log('\n\n\n\n credMetaData = ', JSON.stringify(credMetaData.credential, null, 2))

  // Send basic message from holder to issuer
  const holderConnections = await holder.modules.connections.getAll()
  await holder.modules.basicMessages.sendMessage(holderConnections[0].id, 'Hello this is from holder, How are you?')
  await new Promise((resolve)=> setTimeout(resolve, 2000))
  const isserMessages = await issuer.modules.basicMessages.findAllByQuery({})
  console.log('\n\n\n\n\n isserMessages = \n\n', JSON.stringify(isserMessages, null, 2))

  // Send basic message from issuer to holder
  const issuerConnections = await issuer.modules.connections.getAll()
  await issuer.modules.basicMessages.sendMessage(issuerConnections[0].id, 'Hi, I am issuer and I am good')
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const holderMessages = await holder.modules.basicMessages.findAllByQuery({
    role: BasicMessageRole.Receiver
  })
  console.log('\n\n\n\n Holder Messages = \n\n', JSON.stringify(holderMessages, null, 2)) 


  // Issuer request for the proof
    await issuer.modules.proofs.requestProof({
        connectionId: issuerConnections[0].id,
        protocolVersion: 'v2',
        proofFormats: {
            presentationExchange: {
                presentationDefinition: {
                id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
                input_descriptors: [
                    {
                        constraints: {
                        fields: [
                            {
                                path: ['$.credentialSubject.degree.type'],
                            },
                        ],
                        },
                        id: 'input_1',
                        schema: [{ uri: 'https://www.w3.org/2018/credentials/examples/v1' }],
                    }
                ],
                },
            },
        }
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))
    const holderProofs = await holder.modules.proofs.getAll()
    console.log('\n\n\n Holder Proofs= ', JSON.stringify(holderProofs, null, 2))

    // Holder will share the proof
    await holder.modules.proofs.acceptRequest( {
        proofRecordId: holderProofs[0].id
    })

    await new Promise((resolve) => setTimeout(resolve, 5000))
    const issuerProofs = await issuer.modules.proofs.getAll()
    console.log('\n\n\n Issuer Proofs= ', JSON.stringify(issuerProofs, null, 2))

};



app();
