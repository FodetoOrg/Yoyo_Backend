
// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigurationService } from '../services/configuration.service';

const configurationService = new ConfigurationService();

// Get all configurations
export const getAllConfigurations = async (request: FastifyRequest<{
  Querystring: { category?: string }
}>, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    const { category } = request.query;
    const configurations = await configurationService.getAllConfigurations(category);

    reply.send({
      success: true,
      data: configurations
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      message: error.message || 'Failed to fetch configurations'
    });
  }
};

// Get specific configuration
export const getConfiguration = async (request: FastifyRequest<{
  Params: { key: string }
}>, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    const { key } = request.params;
    const configuration = await configurationService.getConfiguration(key);

    reply.send({
      success: true,
      data: configuration
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      success: false,
      message: error.message || 'Failed to fetch configuration'
    });
  }
};

// Update configuration
export const updateConfiguration = async (request: FastifyRequest<{
  Params: { key: string };
  Body: {
    value: any;
    type: string;
    description?: string;
    category?: string;
  }
}>, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    const { key } = request.params;
    const { value, type, description, category = 'app' } = request.body;

    const configuration = await configurationService.setConfiguration(
      key, value, type, description, category
    );

    reply.send({
      success: true,
      data: configuration,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      message: error.message || 'Failed to update configuration'
    });
  }
};

// Initialize default configurations
export const initializeConfigurations = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    await configurationService.initializeDefaultConfigurations();

    reply.send({
      success: true,
      message: 'Default configurations initialized successfully'
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      message: error.message || 'Failed to initialize configurations'
    });
  }
};

// Get contact information
export const getContactInfo = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    const contactInfo = await configurationService.getContactInfo();

    reply.send({
      success: true,
      data: contactInfo
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      message: error.message || 'Failed to fetch contact information'
    });
  }
};

// Update contact information
export const updateContactInfo = async (request: FastifyRequest<{
  Body: {
    general_inquiries?: {
      phone?: string;
      email?: string;
    };
    support?: {
      phone?: string;
      email?: string;
    };
  }
}>, reply: FastifyReply) => {
  try {
    configurationService.setFastify(request.server);
    
    const contactData = request.body;
    const updatedContactInfo = await configurationService.updateContactInfo(contactData);

    reply.send({
      success: true,
      data: updatedContactInfo,
      message: 'Contact information updated successfully'
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      message: error.message || 'Failed to update contact information'
    });
  }
};


