import { Client, Databases, ID, Query } from 'node-appwrite';

const client = new Client();
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'ENV Key Not Found';
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID || 'ENV Key Not Found';
console.log(`Database ID: ${DATABASE_ID}`);
console.log(`Collection ID: ${COLLECTION_ID}`);

client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || 'ENV Key Not Found')
  .setKey(process.env.APPWRITE_API_KEY || 'ENV Key Not Found');

const databases = new Databases(client);

const listDocuments = async (databaseId: string = DATABASE_ID, collectionId: string = COLLECTION_ID, queries?: string[]) => {
  try {
    return await databases.listDocuments(databaseId, collectionId, queries);
  } catch (error) {
    console.error('Error fetching documents:', error);
  }
};

const createDocument = async (data: any, databaseId: string = DATABASE_ID, collectionId: string = COLLECTION_ID) => {
  try {
    return await databases.createDocument(databaseId, collectionId, ID.unique(), data);
  } catch (error) {
    console.error('Error creating document:', error);
  }
};

export { databases, listDocuments, createDocument, Query };
