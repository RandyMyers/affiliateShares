const MerchantNote = require('../models/MerchantNote');
const { sendResponse } = require('../utils/response');

// Get notes for affiliate
exports.getAffiliateNotes = async (req, res, next) => {
  try {
    const { affiliateId } = req.params;

    const notes = await MerchantNote.find({
      merchant: req.user.id,
      affiliate: affiliateId
    })
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, 'Notes retrieved successfully', notes);
  } catch (error) {
    next(error);
  }
};

// Create note
exports.createNote = async (req, res, next) => {
  try {
    const { affiliateId, note, tags, isPrivate } = req.body;

    if (!affiliateId || !note) {
      return sendResponse(res, 400, 'Affiliate ID and note are required', null);
    }

    const merchantNote = new MerchantNote({
      merchant: req.user.id,
      affiliate: affiliateId,
      note,
      tags: tags || [],
      isPrivate: isPrivate !== undefined ? isPrivate : true
    });

    await merchantNote.save();

    return sendResponse(res, 201, 'Note created successfully', merchantNote);
  } catch (error) {
    next(error);
  }
};

// Update note
exports.updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { note, tags, isPrivate } = req.body;

    const merchantNote = await MerchantNote.findOne({
      _id: noteId,
      merchant: req.user.id
    });

    if (!merchantNote) {
      return sendResponse(res, 404, 'Note not found', null);
    }

    if (note) merchantNote.note = note;
    if (tags) merchantNote.tags = tags;
    if (isPrivate !== undefined) merchantNote.isPrivate = isPrivate;

    await merchantNote.save();

    return sendResponse(res, 200, 'Note updated successfully', merchantNote);
  } catch (error) {
    next(error);
  }
};

// Delete note
exports.deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const merchantNote = await MerchantNote.findOne({
      _id: noteId,
      merchant: req.user.id
    });

    if (!merchantNote) {
      return sendResponse(res, 404, 'Note not found', null);
    }

    await MerchantNote.deleteOne({ _id: noteId });

    return sendResponse(res, 200, 'Note deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

